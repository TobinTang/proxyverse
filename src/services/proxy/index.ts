import { Host } from "@/adapters";
import {
  ProxyProfile,
  ProxyAuthInfo,
  SystemProfile,
  getProfile,
  ProfileAutoSwitch,
} from "../profile";
import { ProxySettingResultDetails } from "@/adapters";
import { ProfileConverter } from "./profile2config";
import { ProfileAuthProvider } from "./auth";

/**
 * ===== 校验逻辑（新增） =====
 * host 不能为空，port 必须为 1~65535
 * auto/pac/system/direct 按类型处理
 */
function validateProfileConfig(profile: ProxyProfile): string | null {
  if (!profile) return "配置为空";

  // direct/system 一定合法
  if (profile.proxyType === "direct" || profile.proxyType === "system") {
    return null;
  }

  // auto 模式：基本校验
  if (profile.proxyType === "auto") {
    const p = profile as ProfileAutoSwitch;
    if (!p.defaultProfileID || !p.defaultProfileID.trim()) {
      return "auto 模式缺少 defaultProfileID";
    }
    if (!Array.isArray(p.rules)) {
      return "auto 模式 rules 非数组";
    }
    for (const r of p.rules) {
      if (!r.profileID || !r.profileID.trim()) {
        return "auto 模式中存在空的 profileID";
      }
    }
    return null;
  }

  // proxy / pac 模式 → 校验 proxyRules
  const p: any = profile as any;
  const rules = p.proxyRules;

  // pac 模式但没 pacScript
  if (profile.proxyType === "pac") {
    if (!p.pacScript || (!p.pacScript.url && !p.pacScript.data)) {
      return "PAC 配置缺少 pacScript";
    }
  }

  if (!rules || !rules.default) {
    return "proxyRules 或 default 配置为空";
  }

  const servers = [
    rules.default,
    rules.http,
    rules.https,
    rules.ftp,
  ].filter(Boolean);

  for (const s of servers) {
    if (!s.host || !s.host.toString().trim()) {
      return "代理 host 不能为空";
    }
    const portNum = Number(s.port);
    if (!Number.isInteger(portNum) || portNum <= 0 || portNum > 65535) {
      return `代理端口不合法: ${s.port}`;
    }
  }

  return null;
}

/* ================================
 * 原文件逻辑开始（完全保留）
 * ================================ */

export type ProxySetting = {
  activeProfile?: ProxyProfile;
  setting: ProxySettingResultDetails;
};

const keyActiveProfile = "active-profile";

async function wrapProxySetting(setting: ProxySettingResultDetails) {
  const ret: ProxySetting = {
    setting,
  };

  if (setting.levelOfControl == "controlled_by_this_extension") {
    ret.activeProfile =
      (await Host.get<ProxyProfile>(keyActiveProfile)) || undefined;
  }

  switch (setting.value?.mode) {
    case "system":
      ret.activeProfile = SystemProfile.SYSTEM;
      break;
    case "direct":
      ret.activeProfile = SystemProfile.DIRECT;
      break;
  }

  return ret;
}

export async function getCurrentProxySetting() {
  const setting = await Host.getProxySettings();
  return await wrapProxySetting(setting);
}

/**
 * 修改：这里加入校验逻辑
 */
export async function setProxy(val: ProxyProfile) {
  // ======= 新增校验阻断 =======
  const err = validateProfileConfig(val);
  if (err) {
    // 不写入 chrome.ProxySettings，避免污染环境
    throw new Error("代理配置错误: " + err);
  }
  // ==============================

  switch (val.proxyType) {
    case "system":
      await Host.clearProxy();
      break;

    default:
      const profile = new ProfileConverter(val, getProfile);
      await Host.setProxy(await profile.toProxyConfig());
      break;
  }

  await Host.set<ProxyProfile>(keyActiveProfile, val);
}

/**
 * Refresh the current proxy setting. This is useful when the proxy setting is changed by user.
 * @returns
 */
export async function refreshProxy() {
  const current = await getCurrentProxySetting();
  // if it's not controlled by this extension, then do nothing
  if (!current.activeProfile) {
    return;
  }

  const newProfile = await getProfile(current.activeProfile.profileID);

  // if it's preset profiles, then do nothing
  if (!newProfile || current.activeProfile.proxyType in ["system", "direct"]) {
    return;
  }

  // ======= 新增校验防止 refresh 写入坏配置 =======
  const err = validateProfileConfig(newProfile);
  if (err) {
    console.warn("[proxy] refreshProxy 跳过非法配置：", err);
    return;
  }
  // =================================================

  const profile = new ProfileConverter(newProfile, getProfile);
  await Host.setProxy(await profile.toProxyConfig());
}

export async function previewAutoSwitchPac(val: ProfileAutoSwitch) {
  const profile = new ProfileConverter(val, getProfile);
  return await profile.toPAC();
}

export async function getAuthInfos(
  host: string,
  port: number
): Promise<ProxyAuthInfo[]> {
  const profile = await Host.get<ProxyProfile>(keyActiveProfile);
  if (!profile) {
    return [];
  }

  const authProvider = new ProfileAuthProvider(profile, getProfile);
  return await authProvider.getAuthInfos(host, port);
}
