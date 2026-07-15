import { BrowserRouter } from "react-router-dom";
import AntApp from "antd/es/app";
import ConfigProvider from "antd/es/config-provider";
import { AppProviders } from "./app/AppProviders";
import { AppShell } from "./app/AppShell";
import { useI18n } from "@/app/providers/I18nContext";
import "./styles/tokens.css";
import "./styles/pro-theme.css";
import "./styles/layout.css";

function AppFrame() {
  const { antdLocale } = useI18n();

  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{
        token: {
          colorPrimary: "var(--accent-blue)",
          colorSuccess: "var(--accent-green)",
          colorWarning: "var(--accent-yellow)",
          colorError: "var(--accent-red)",
          colorText: "var(--text-secondary)",
          colorTextSecondary: "var(--text-muted)",
          colorTextTertiary: "var(--text-faint)",
          colorBgBase: "var(--bg-base)",
          colorBgContainer: "var(--bg-surface)",
          colorBgElevated: "var(--bg-elevated)",
          colorBorder: "var(--border-default)",
          colorBorderSecondary: "var(--border-subtle)",
          colorFillSecondary: "var(--bg-surface-2)",
          colorFillTertiary: "var(--bg-hover)",
          borderRadius: 12,
          borderRadiusLG: 18,
          controlHeight: 32,
          fontSize: 13,
          fontFamily: "var(--font-sans)",
          boxShadow: "var(--shadow-soft)",
          boxShadowSecondary: "var(--shadow-soft)",
        },
        components: {
          Button: {
            borderRadius: 10,
            controlHeight: 32,
            paddingInline: 12,
            defaultBg: "var(--bg-surface)",
            defaultBorderColor: "var(--border-default)",
            defaultColor: "var(--text-secondary)",
          },
          Card: {
            borderRadiusLG: 14,
            colorBgContainer: "var(--bg-surface)",
          },
          Input: {
            colorBgContainer: "var(--bg-surface)",
            activeBorderColor: "var(--accent-blue)",
            hoverBorderColor: "var(--border-default)",
          },
          Select: {
            colorBgContainer: "var(--bg-surface)",
          },
          Tabs: {
            itemColor: "var(--text-muted)",
            itemSelectedColor: "var(--accent-blue)",
            itemHoverColor: "var(--text-secondary)",
            inkBarColor: "var(--accent-blue)",
          },
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}

function App() {
  return (
    <AppProviders>
      <AppFrame />
    </AppProviders>
  );
}

export default App;
