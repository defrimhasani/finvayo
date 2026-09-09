import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "../../public/styles.css";
import "../../public/product.css";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import AppPage from "./pages/AppPage";
import InvoicesPage from "./pages/InvoicesPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { SignupPage } from "./pages/SignupPage";
import SettingsPage from "./pages/SettingsPage";
import { setPageMetadata } from "./utils/page";
import "./types";

const path = window.location.pathname.replace(/\/+$/, "") || "/";
const bootstrap = window.__FINVAYO__ ?? {};

let page: ReactNode;

switch (path) {
  case "/":
    document.body.className = "";
    setPageMetadata("Finvayo | Calm cash-flow decisions", "#f2efe8", {
      description: "Finvayo helps independent businesses see what is safe to spend and where cash gets tight over the next 90 days.",
    });
    page = <LandingPage />;
    break;
  case "/login":
    document.body.className = "login-page";
    setPageMetadata("Sign in | Finvayo", "#17221e", { robots: "noindex" });
    page = <LoginPage />;
    break;
  case "/signup":
    document.body.className = "login-page";
    setPageMetadata("Start free | Finvayo", "#17221e", { robots: "noindex" });
    page = <SignupPage />;
    break;
  case "/forgot-password":
    document.body.className = "login-page";
    setPageMetadata("Forgot password | Finvayo", "#17221e", { robots: "noindex, noarchive", referrer: "no-referrer" });
    page = <ForgotPasswordPage />;
    break;
  case "/reset-password":
    document.body.className = "login-page";
    setPageMetadata("Reset password | Finvayo", "#17221e", { robots: "noindex, noarchive", referrer: "no-referrer" });
    page = <ResetPasswordPage token={bootstrap.resetToken} />;
    break;
  case "/app":
  case "/app/preview":
    document.body.className = "app-page";
    setPageMetadata("Overview | Finvayo", "#f2efe8", { robots: "noindex, noarchive" });
    page = <AppPage />;
    break;
  case "/app/settings":
    document.body.className = "app-page";
    setPageMetadata("Settings | Finvayo", "#f2efe8", { robots: "noindex, noarchive" });
    page = <SettingsPage />;
    break;
  case "/app/invoices":
    document.body.className = "app-page";
    setPageMetadata("Invoices | Finvayo", "#f2efe8", { robots: "noindex, noarchive" });
    page = <InvoicesPage />;
    break;
  default:
    document.body.className = "";
    setPageMetadata("Page not found | Finvayo", "#f2efe8", { robots: "noindex" });
    page = <NotFoundPage />;
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing React root element");

createRoot(root).render(<StrictMode>{page}</StrictMode>);
