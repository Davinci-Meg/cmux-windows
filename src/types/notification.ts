export interface AppNotification {
  id: string;
  title: string;
  body: string;
  source: "agent" | "osc";
  tabId: string;
  timestamp: number;
  read: boolean;
}
