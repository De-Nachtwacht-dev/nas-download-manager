import {
  SessionName,
  SynologyClient,
  ConnectionFailure,
  ClientRequestResult,
} from "../common/apis/synology";
import { Settings, getHostUrl, ConnectionSettings, State } from "../common/state";
import { saveLastSevereError } from "../common/errorHandlers";

export async function saveSettings(settings: Settings): Promise<boolean> {
  console.log("persisting settings...");
  try {
    await browser.storage.local.set<Partial<State>>({ settings });
    console.log("done persisting settings");
    return true;
  } catch (e) {
    saveLastSevereError(e);
    return false;
  }
}

export type ConnectionTestResult = ConnectionFailure | { failureCode: number } | "success";

export function isErrorCodeResult(result: ConnectionTestResult): result is { failureCode: number } {
  return (result as { failureCode: number }).failureCode != null;
}

export async function testConnection(settings: ConnectionSettings): Promise<ConnectionTestResult> {
  const api = new SynologyClient({
    baseUrl: getHostUrl(settings),
    account: settings.username,
    passwd: settings.password,
    session: SessionName.DownloadStation,
  });

  const loginResult = await api.Auth.Login({ timeout: 30000 });
  if (ClientRequestResult.isConnectionFailure(loginResult)) {
    return loginResult;
  } else if (!loginResult.success) {
    return { failureCode: loginResult.error.code };
  } else {
    // Note that this is fire-and-forget.
    api.Auth.Logout({ timeout: 10000 }).then((logoutResponse) => {
      if (logoutResponse === "not-logged-in") {
        // Typescript demands we handle this case, which is correct, but also, it's pretty wat
        console.error(`wtf: not logged in immediately after successfully logging in`);
      } else if (
        ClientRequestResult.isConnectionFailure(logoutResponse) ||
        !logoutResponse.success
      ) {
        console.error(
          "ignoring unexpected failure while logging out after successful connection test",
          logoutResponse,
        );
      }
    });
    return "success";
  }
}
