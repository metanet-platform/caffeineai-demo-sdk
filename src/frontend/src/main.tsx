/**
 * main.tsx — React bootstrap.
 *
 * NOTE: There is deliberately NO Internet Identity provider here. On the Metanet
 * social network (metanet.page) an app runs in a sandboxed iframe where Internet
 * Identity is unreachable; identity comes from the platform via shuriken-sdk's
 * connection response, and the ICP delegation is built from `me.icIdentityPackage`
 * inside <SDKProvider> (see contexts/SDKProvider.tsx + lib/icpIdentity.ts).
 *
 * We keep QueryClientProvider so data-fetching utilities (and the config/actor
 * wiring) still work, and the BigInt.toJSON shim so ICP amounts serialize cleanly.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

BigInt.prototype.toJSON = function () {
  return this.toString();
};

declare global {
  interface BigInt {
    toJSON(): string;
  }
}

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
