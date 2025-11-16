<script setup lang="ts">
import { type RouteLocationRaw, useRouter } from "vue-router";
import { Message } from "@arco-design/web-vue";
import { onMounted, ref, toRaw } from "vue";
import {
  IconDesktop,
  IconSwap,
  IconRelation,
  IconPlus,
  IconTool,
} from "@arco-design/web-vue/es/icon";
import ThemeSwitcher from "../components/controls/ThemeSwitcher.vue";
import {
  ProfilesStorage,
  listProfiles,
  SystemProfile,
  ProxyProfile,
} from "../services/profile";
import { setProxy, getCurrentProxySetting } from "../services/proxy";
import { Host } from "@/adapters";

const router = useRouter();
const profiles = ref<ProfilesStorage>({});
const selectedKeys = defineModel<string[]>();

// 多色圆点（用于尚未检测国家的 profile）
const colorPalette = [
  "#ff7070", // 红
  "#ffa640", // 橙
  "#ffd84d", // 黄
  "#8bd448", // 绿
  "#48c9c9", // 青
  "#4a8bff", // 蓝
  "#9f6bff", // 紫
  "#ff73c7", // 粉
  "#00b894", // 青绿
  "#fab1a0", // 淡橙
];

interface ProfileCountryInfo {
  code: string;   // 国家代码，如 JP / HK
  name: string;   // 国家名称
  flag: string;   // 国旗 emoji
  city?: string;  // 城市
  ip?: string;    // IP
}

// 保存 profile 出口国家信息
const COUNTRY_STORAGE_KEY = "profileCountries";
const profileCountries = ref<Record<string, ProfileCountryInfo>>({});

// 当前出口 IP（底部显示）
const currentExitInfo = ref<{
  ip: string;
  country: string;
  city: string;
  flag: string;
} | null>(null);

// 国家代码 -> 国旗 emoji
const countryCodeToFlag = (code: string): string => {
  if (!code || code.length !== 2) return "🌐";
  const base = 0x1f1e6;
  const chars = code
    .toUpperCase()
    .split("")
    .map((c) => base + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...chars);
};

// 使用 ip-api.com 检测当前出口国家/IP，并记录到 profileCountries & currentExitInfo
const detectExitCountry = async (profileID: string) => {
  try {
    // 免费接口，仅支持 http；在扩展环境中是允许的
    const resp = await fetch("http://ip-api.com/json/?lang=en");
    const data = await resp.json();

    if (!data || data.status !== "success") {
      console.warn("Failed to detect exit country", data);
      return;
    }

    const code: string = data.countryCode || "UN";
    const name: string = data.country || "Unknown";
    const city: string = data.city || data.regionName || name;
    const ip: string = data.query || "";
    const flag = countryCodeToFlag(code);

    const updated: Record<string, ProfileCountryInfo> = {
      ...profileCountries.value,
      [profileID]: { code, name, flag, city, ip },
    };
    profileCountries.value = updated;

    // 当前出口 IP 信息（底部展示）
    currentExitInfo.value = {
      ip,
      country: name,
      city,
      flag,
    };

    // 持久化保存
    chrome.storage.local.set({ [COUNTRY_STORAGE_KEY]: updated });
  } catch (e) {
    console.error("detectExitCountry error:", e);
  }
};

onMounted(async () => {
  // 读取 profile 列表
  profiles.value = await listProfiles();

  // 当前激活的 profile
  const proxy = await getCurrentProxySetting();
  const profileID = proxy.activeProfile?.profileID;
  if (profileID) {
    selectedKeys.value = [profileID];
  }

  // 从 storage 读取曾经检测过的 profile 出口信息
  chrome.storage.local.get(COUNTRY_STORAGE_KEY, (result) => {
    const saved = result[COUNTRY_STORAGE_KEY];
    if (saved && typeof saved === "object") {
      profileCountries.value = saved as Record<string, ProfileCountryInfo>;

      // 如果当前 profile 有记录，用它初始化底部出口信息
      if (profileID && saved[profileID]) {
        const info = saved[profileID] as ProfileCountryInfo;
        currentExitInfo.value = {
          ip: info.ip || "",
          country: info.name,
          city: info.city || info.name,
          flag: info.flag || countryCodeToFlag(info.code),
        };
      }
    }
  });

  // 主动检测一次当前出口 IP（保证底部信息是最新的）
  if (profileID) {
    detectExitCountry(profileID);
  }
});

const jumpTo = (to: RouteLocationRaw) => {
  const path = router.resolve(to).fullPath;
  window.open(`/index.html#${path}`, import.meta.url);
};

// 打开 ip.sb 检查出口 IP（手动确认）
const openIPCheck = () => {
  chrome.tabs.create({ url: "https://ip.sb" });
};

// 切换代理
const setProxyByProfile = async (val: ProxyProfile) => {
  try {
    const raw = toRaw(val);
    await setProxy(raw);
    const pid = typeof val === "string" ? val : raw.profileID;
    selectedKeys.value = [pid];

    // 切换成功后检测该 profile 的出口国家/IP
    detectExitCountry(pid);
  } catch (e: any) {
    Message.error({
      content: Host.getMessage("config_feedback_error_occurred", e.toString()),
    });
  }
};
</script>

<template>
  <a-layout class="popup">
    <a-layout-header>
      <section class="logo">
        <img src="/full-logo.svg" />
      </section>
    </a-layout-header>

    <a-layout-content class="profiles">
      <a-menu :selected-keys="selectedKeys">
        <!-- 直连 -->
        <a-menu-item
          :key="SystemProfile.DIRECT.profileID"
          @click.prevent="() => setProxyByProfile(SystemProfile.DIRECT)"
        >
          <template #icon><icon-swap /></template>
          {{ $t("mode_direct") }}
        </a-menu-item>

        <!-- 使用系统代理 -->
        <a-menu-item
          :key="SystemProfile.SYSTEM.profileID"
          @click.prevent="() => setProxyByProfile(SystemProfile.SYSTEM)"
        >
          <template #icon><icon-desktop /></template>
          {{ $t("mode_system") }}
        </a-menu-item>

        <!-- 新建代理：和上面同级 -->
        <a-menu-item
          key="create_profile"
          @click.prevent="jumpTo({ name: 'profile.home' })"
        >
          <template #icon>
            <icon-plus />
          </template>
          {{ $t("mode_profile_create") }}
        </a-menu-item>

        <!-- Mac 风格极细分割线 -->
        <a-divider />

        <!-- 下方正式的 profile 列表：带国旗 / 城市 / 彩色竖条 -->
        <a-menu-item
          v-for="(item, index) in profiles"
          :key="item.profileID"
          @click.prevent="() => setProxyByProfile(item)"
          class="custom-profiles"
          :style="{
            '--indicator-color': colorPalette[index % colorPalette.length],
          }"
        >
          <template #icon>
            <!-- 已检测过国家：显示国旗 -->
            <span
              v-if="profileCountries[item.profileID]"
              class="flag-icon"
              :title="profileCountries[item.profileID].name"
            >
              {{ profileCountries[item.profileID].flag }}
            </span>

            <!-- 未检测过：显示彩色圆点 -->
            <span v-else class="color-indicator"></span>
          </template>

          <!-- 名称 + 城市文本 -->
          <span class="profile-text">
            {{ item.profileName }}
            <span
              v-if="profileCountries[item.profileID]?.city"
              class="profile-city"
            >
              · {{ profileCountries[item.profileID].city }}
            </span>
          </span>
        </a-menu-item>
      </a-menu>
    </a-layout-content>

    <!-- 底部按钮区 + 当前出口 IP 显示 -->
    <a-layout-footer>
      <section class="settings">
        <a-button-group type="text" size="large">
          <!-- 配置 -->
          <a-button @click="jumpTo({ name: 'profile.home' })">
            <template #icon>
              <icon-tool size="medium" />
            </template>
            {{ $t("nav_config") }}
          </a-button>

          <!-- IP 检查 -->
          <a-button @click="openIPCheck">
            <template #icon>
              <icon-desktop size="medium" />
            </template>
            IP
          </a-button>

          <a-divider direction="vertical" />

          <!-- 主题切换 -->
          <ThemeSwitcher size="large" />
        </a-button-group>

        <!-- 当前出口 IP 区域（靠左显示） -->
        <div v-if="currentExitInfo" class="exit-info">
          当前出口 IP：
          <span class="exit-ip">{{ currentExitInfo.ip }}</span>
          <span class="exit-flag">{{ currentExitInfo.flag }}</span>
          <span class="exit-city">
            {{ currentExitInfo.city || currentExitInfo.country }}
          </span>
        </div>
      </section>
    </a-layout-footer>
  </a-layout>
</template>

<style lang="scss">
.popup {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: calc(100vh + 50px);

  .logo {
    text-align: center;
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.08); /* Mac 风格细线 */
    background-color: var(--color-bg-4);
    padding: 0.6em 0.4em;

    img {
      max-height: 2.6em;
    }
  }

  .settings {
    padding: 0.2em 0.6em 0.4em;
    text-align: center;
    border-top: 0.5px solid rgba(255, 255, 255, 0.08); /* Mac 风格细线 */
    background-color: var(--color-bg-5);

    .exit-info {
      margin-top: 4px;
      font-size: 11px;
      color: var(--color-text-3);
      display: flex;
      justify-content: flex-start; /* 靠左显示 */
      align-items: center;
      gap: 4px;

      .exit-ip {
        font-family: monospace;
        font-size: 11px;
      }

      .exit-flag {
        font-size: 13px;
      }

      .exit-city {
        opacity: 0.9;
      }
    }
  }

  .profiles {
    overflow-y: auto;

    /* Mac 风格分割线：极细、低对比 */
    :deep(.arco-divider-horizontal) {
      margin: 4px 0;
      border-top: 0.5px solid rgba(255, 255, 255, 0.06);
    }

    .arco-menu-inner {
      padding-left: 0;

      .arco-menu-item {
        position: relative;
        padding: 6px 12px !important;   /* 行高更紧凑 */
        min-height: 32px !important;
        font-size: 13px;
        line-height: 16px;

        .profile-text {
          display: inline-flex;
          align-items: baseline;
          gap: 4px;
        }

        .profile-city {
          font-size: 11px;
          color: var(--color-text-3);
        }

        .color-indicator {
          display: inline-block;
          width: 0.85em;
          height: 0.85em;
          border-radius: 50%;
          background-color: var(--indicator-color, #999);
          margin-right: 6px;
        }

        .flag-icon {
          font-size: 1.1em;
          margin-right: 6px;
          line-height: 1;
        }

        &.custom-profiles::before {
          content: "";
          display: block;
          height: 100%;
          width: 4px;
          background-color: var(--indicator-color, #999);
          position: absolute;
          left: 0;
          top: 0;
          border-radius: 0 3px 3px 0;
        }

        /* hover 高亮 */
        &:hover {
          background-color: rgba(var(--primary-6), 0.10) !important;
        }
      }

      /* 选中项：深色、高亮 */
      .arco-menu-item.arco-menu-item-active {
        background-color: rgba(var(--primary-6), 0.25) !important;
        font-weight: 600;

        &.custom-profiles::before {
          background-color: rgb(var(--primary-6)) !important;
        }
      }
    }
  }
}
</style>
