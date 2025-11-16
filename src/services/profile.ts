import { Host, PacScript, SimpleProxyServer } from "@/adapters";

export type ProxyAuthInfo = {
  username: string;
  password: string;
};

export interface ProxyServer extends SimpleProxyServer {
  auth?: ProxyAuthInfo;
  scheme: "direct" | "http" | "https" | "socks4" | "socks5";
}

export function sanitizeProxyServer(v: ProxyServer): SimpleProxyServer {
  return {
    host: v.host,
    port: v.port,
  };
}

export type ProxyConfigMeta = {
  profileID: string;
  color: string;
  profileName: string;
  proxyType: "proxy" | "pac" | "system" | "direct" | "auto";
};

// the basic proxy config, with authentication and pac script support
export type ProxyConfigSimple =
  | {
      proxyType: "proxy";
      proxyRules: {
        default: ProxyServer;
        http?: ProxyServer;
        https?: ProxyServer;
        ftp?: ProxyServer;
        bypassList: string[];
      };
      pacScript?: PacScript;
    }
  | {
      proxyType: "pac";
      proxyRules?: {
        default: ProxyServer;
        http?: ProxyServer;
        https?: ProxyServer;
        ftp?: ProxyServer;
        bypassList: string[];
      };
      pacScript: PacScript;
    };

// advanced proxy config, with auto switch support
export type AutoSwitchType = "domain" | "cidr" | "url" | "disabled";
export type AutoSwitchRule = {
  type: AutoSwitchType;
  condition: string;
  profileID: string;
};

export type ProxyConfigAutoSwitch = {
  rules: AutoSwitchRule[];
  defaultProfileID: string;
};

export type ProfileSimple = ProxyConfigMeta & ProxyConfigSimple;

export type ProfilePreset = ProxyConfigMeta & {
  proxyType: "system" | "direct";
};

export type ProfileAutoSwitch = ProxyConfigMeta & {
  proxyType: "auto";
} & ProxyConfigAutoSwitch;

export type ProxyProfile = ProfileSimple | ProfilePreset | ProfileAutoSwitch;

export const SystemProfile: Record<string, ProxyProfile> = {
  DIRECT: {
    profileID: "direct",
    color: "#7ad39e",
    profileName: "Direct",
    proxyType: "direct",
  },
  SYSTEM: {
    profileID: "system",
    color: "#0000",
    profileName: "", // should be empty
    proxyType: "system",
  },
};

const keyProfileStorage = "profiles";
export type ProfilesStorage = Record<string, ProxyProfile>;
const onProfileUpdateListeners: ((p: ProfilesStorage) => void)[] = [];

// list all user defined profiles. System profiles are not included
export async function listProfiles(): Promise<ProfilesStorage> {
  const s = await Host.get<ProfilesStorage>(keyProfileStorage);
  return s || {};
}

export function onProfileUpdate(callback: (p: ProfilesStorage) => void) {
  onProfileUpdateListeners.push(callback);
}

async function overwriteProfiles(profiles: ProfilesStorage) {
  await Host.set(keyProfileStorage, profiles);
  onProfileUpdateListeners.map((cb) => cb(profiles));
}

/**
 * Save a single profile to the storage.
 * Please be noticed that this is not promise-safe. If you want to save multiple profiles, use `saveManyProfiles` instead.
 *
 * @param profile
 */
export async function saveProfile(profile: ProxyProfile) {
  const data = await listProfiles();
  data[profile.profileID] = profile;
  await overwriteProfiles(data);
}

export async function saveManyProfiles(profiles: ProxyProfile[]) {
  let data = await listProfiles();
  profiles.forEach((p) => {
    data[p.profileID] = p;
  });
  await overwriteProfiles(data);
}

export async function getProfile(
  profileID: string,
  userProfileOnly?: boolean
): Promise<ProxyProfile | undefined> {
  if (!userProfileOnly) {
    // check if it's a system profile
    for (const p of Object.values(SystemProfile)) {
      if (p.profileID === profileID) {
        return p;
      }
    }
  }

  const data = await listProfiles();
  return data[profileID];
}

export async function deleteProfile(profileID: string) {
  const data = await listProfiles();
  delete data[profileID];
  await overwriteProfiles(data);
}

/**
 * ✅ 校验 ProxyProfile 合法性
 * - 返回 null 表示通过
 * - 返回错误字符串表示有问题
 */
export function validateProfile(profile: ProxyProfile): string | null {
  if (!profile) {
    return "配置为空";
  }

  // direct / system 不需要校验
  if (profile.proxyType === "direct" || profile.proxyType === "system") {
    return null;
  }

  // auto 模式：检查 rules 与 profileID
  if (profile.proxyType === "auto") {
    const autoProfile = profile as ProfileAutoSwitch;
    if (!autoProfile.rules || !Array.isArray(autoProfile.rules)) {
      return "Auto 模式下 rules 不合法";
    }
    for (const r of autoProfile.rules) {
      if (!r.profileID || !r.profileID.trim()) {
        return "Auto 模式中存在空的 profileID";
      }
    }
    if (!autoProfile.defaultProfileID || !autoProfile.defaultProfileID.trim()) {
      return "Auto 模式下 defaultProfileID 不能为空";
    }
    return null;
  }

  // pac 模式：pacScript 必须存在，同时可能也带有 proxyRules
  if (profile.proxyType === "pac") {
    const pacProfile = profile as ProfileSimple;
    if (!pacProfile.pacScript) {
      return "PAC 配置缺少 pacScript";
    }
    if (pacProfile.proxyRules) {
      const err = validateProxyRules(pacProfile.proxyRules);
      if (err) return err;
    }
    return null;
  }

  // proxy 模式：主要校验 proxyRules
  if (profile.proxyType === "proxy") {
    const proxyProfile = profile as ProfileSimple;
    const err = validateProxyRules(proxyProfile.proxyRules);
    if (err) return err;
    return null;
  }

  return null;
}

/**
 * ✅ 校验 proxyRules 内容：host 必须非空，port 必须为 1–65535 整数
 */
function validateProxyRules(rules: {
  default: ProxyServer;
  http?: ProxyServer;
  https?: ProxyServer;
  ftp?: ProxyServer;
  bypassList: string[];
}): string | null {
  if (!rules || !rules.default) {
    return "proxyRules 或 default 服务器配置为空";
  }

  const servers: ProxyServer[] = [
    rules.default,
    rules.http,
    rules.https,
    rules.ftp,
  ].filter(Boolean) as ProxyServer[];

  for (const server of servers) {
    const host = (server.host || "").trim();
    if (!host) {
      return "代理 host 不能为空";
    }

    const portNum = Number(server.port);
    if (!Number.isInteger(portNum) || portNum <= 0 || portNum > 65535) {
      return `代理端口不合法: ${server.port}`;
    }
  }

  return null;
}
