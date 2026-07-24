import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

export const loadSettingsDialog = () =>
  import("@/components/clinical-dashboard/settings-dialog").then((module) => module.SettingsDialog);

export const SettingsDialog = dynamic(loadSettingsDialog, { ssr: false });

const loadAccountSetupDialog = () =>
  import("@/components/clinical-dashboard/account-setup-dialog").then((module) => module.AccountSetupDialog);

export const AccountSetupDialog = dynamic(loadAccountSetupDialog, { ssr: false });

export function prefetchAccountDialog() {
  void loadSettingsDialog();
  void loadAccountSetupDialog();
}

export function SidebarSettingsDialog(props: ComponentProps<typeof SettingsDialog>) {
  return props.open ? <SettingsDialog {...props} /> : null;
}

export function SidebarAccountSetupDialog(props: ComponentProps<typeof AccountSetupDialog>) {
  return props.open ? <AccountSetupDialog {...props} /> : null;
}
