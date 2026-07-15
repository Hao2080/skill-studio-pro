import { useEffect, useState } from "react";
import { Database, Eye, HardDrive, Info, Keyboard, Languages, MoonStar, ScanSearch, Shield, SlidersHorizontal } from "lucide-react";
import { PageHeader, StatusBadge } from "@/shared/components/pro";
import "../pro-styles.css";

interface AccessibilityPreferences { reduceMotion: boolean; reduceTransparency: boolean; }

function readPreferences(): AccessibilityPreferences {
  if (typeof window === "undefined") return { reduceMotion: false, reduceTransparency: false };
  return {
    reduceMotion: localStorage.getItem("skill-studio-pro.reduce-motion") === "true",
    reduceTransparency: localStorage.getItem("skill-studio-pro.reduce-transparency") === "true",
  };
}

export function ProSettingsPage() {
  const [preferences, setPreferences] = useState(readPreferences);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(preferences.reduceMotion);
    document.documentElement.dataset.reduceTransparency = String(preferences.reduceTransparency);
    localStorage.setItem("skill-studio-pro.reduce-motion", String(preferences.reduceMotion));
    localStorage.setItem("skill-studio-pro.reduce-transparency", String(preferences.reduceTransparency));
  }, [preferences]);

  return (
    <div className="pro-page pro-settings-page"><div className="pro-page__inner">
      <PageHeader eyebrow="APPLICATION PREFERENCES" title="设置" subtitle="管理界面、扫描、中央库与隐私。后端尚未完成的设置以浏览器 Mock 展示。" />
      <div className="settings-pro-layout">
        <nav className="settings-pro-nav glass-panel" aria-label="设置分类">{[{icon:SlidersHorizontal,label:"通用"},{icon:ScanSearch,label:"扫描"},{icon:Database,label:"中央库"},{icon:Shield,label:"隐私"},{icon:Info,label:"开源与关于"}].map(({icon:Icon,label},index)=><button type="button" key={label} className={index===0?"is-active":""}><Icon size={14}/>{label}</button>)}</nav>
        <div className="settings-pro-content">
          <section className="glass-panel settings-pro-section"><header><span><MoonStar size={17}/></span><div><h2>外观与辅助功能</h2><p>深海蓝暗色为默认主题，透明度和动效始终可以降低。</p></div></header>
            <SettingRow icon={<MoonStar size={14}/>} title="主题" description="适配深海蓝暗色与高对比浅色。"><select defaultValue="dark" aria-label="主题"><option value="dark">深海蓝暗色</option><option value="light">浅色</option><option value="system">跟随系统</option></select></SettingRow>
            <SettingRow icon={<Languages size={14}/>} title="界面语言" description="导航与 Pro 页面框架的显示语言。"><select defaultValue="zh-CN" aria-label="界面语言"><option value="zh-CN">简体中文</option><option value="en-US">English</option></select></SettingRow>
            <SettingRow icon={<Keyboard size={14}/>} title="减少动态效果" description="关闭位移、淡入与连续动画。"><Toggle checked={preferences.reduceMotion} onChange={(checked)=>setPreferences((value)=>({...value,reduceMotion:checked}))} label="减少动态效果" /></SettingRow>
            <SettingRow icon={<Eye size={14}/>} title="降低透明度" description="使用不透明深海蓝表面替代玻璃模糊。"><Toggle checked={preferences.reduceTransparency} onChange={(checked)=>setPreferences((value)=>({...value,reduceTransparency:checked}))} label="降低透明度" /></SettingRow>
          </section>
          <section className="glass-panel settings-pro-section"><header><span><HardDrive size={17}/></span><div><h2>本地数据与扫描</h2><p>路径为只读 Mock，真实变更需由后端计划与校验。</p></div></header>
            <SettingRow icon={<HardDrive size={14}/>} title="数据目录" description="中央库、快照与索引的位置。"><code>~/.skill-studio-pro/</code></SettingRow>
            <SettingRow icon={<ScanSearch size={14}/>} title="文件监听" description="监听不可用时仍可手动重新扫描。"><StatusBadge label="5 个根在线" tone="success"/></SettingRow>
            <SettingRow icon={<Database size={14}/>} title="快照策略" description="发布和删除前自动创建恢复点。"><select defaultValue="safe" aria-label="快照策略"><option value="safe">安全优先</option><option value="manual">仅手动</option></select></SettingRow>
          </section>
          <section className="glass-panel settings-pro-section about-pro"><header><span><Info size={17}/></span><div><h2>关于 Skill Studio Pro</h2><p>基于开源 Skill Studio 改造，继续采用 Apache-2.0。</p></div></header><dl><div><dt>版本</dt><dd>0.1.0 · Wave 1 UI Shell</dd></div><div><dt>上游基线</dt><dd><code>liu673/skill-studio@cd0bb0a</code></dd></div><div><dt>运行栈</dt><dd>Tauri 2 · React 18 · TypeScript</dd></div></dl></section>
        </div>
      </div>
    </div></div>
  );
}

function SettingRow({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return <div className="settings-pro-row"><span>{icon}</span><div><strong>{title}</strong><p>{description}</p></div><div className="settings-pro-row__control">{children}</div></div>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean)=>void; label: string }) {
  return <label className="pro-switch"><input type="checkbox" checked={checked} onChange={(event)=>onChange(event.target.checked)} aria-label={label}/><span/><em>{checked?"已启用":"已关闭"}</em></label>;
}
