import { lazy, StrictMode, Suspense, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import { setPageMetadata } from "./utils/page";
import "./types";

const LandingPage = lazy(() => import("./pages/LandingPage").then((module) => ({ default: module.LandingPage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const SignupPage = lazy(() => import("./pages/SignupPage").then((module) => ({ default: module.SignupPage })));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage").then((module) => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage").then((module) => ({ default: module.ResetPasswordPage })));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));
const AppPage = lazy(() => import("./pages/AppPage"));
const TransactionsPage = lazy(() => import("./pages/TransactionsPage"));
const PartiesPage = lazy(() => import("./pages/PartiesPage"));
const CashPlanPage = lazy(() => import("./pages/CashPlanPage"));
const ScenariosPage = lazy(() => import("./pages/ScenariosPage"));
const ReviewsPage = lazy(() => import("./pages/ReviewsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const InvoicesPage = lazy(() => import("./pages/InvoicesPage"));

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
    document.body.className = "app-page";
    setPageMetadata("Overview | Finvayo", "#f2efe8", { robots: "noindex, noarchive" });
    page = <AppPage />;
    break;
  case "/app/preview":
    document.body.className = "app-page";
    setPageMetadata("Product preview | Finvayo", "#f2efe8", { robots: "noindex, noarchive", description: "Explore a sample Finvayo cash overview." });
    page = <AppPage />;
    break;
  case "/app/transactions":
    document.body.className = "app-page";
    setPageMetadata("Transactions | Finvayo", "#f2efe8", { robots: "noindex, noarchive", description: "Record and manage business cash movements." });
    page = <TransactionsPage />;
    break;
  case "/app/parties":
    document.body.className = "app-page";
    setPageMetadata("Parties | Finvayo", "#f2efe8", { robots: "noindex, noarchive", description: "Manage customers and suppliers." });
    page = <PartiesPage />;
    break;
  case "/app/cash-plan":
    document.body.className = "app-page";
    setPageMetadata("Cash plan | Finvayo", "#f2efe8", { robots: "noindex, noarchive", description: "Review your 90-day cash forecast." });
    page = <CashPlanPage />;
    break;
  case "/app/scenarios":
    document.body.className = "app-page";
    setPageMetadata("Scenarios | Finvayo", "#f2efe8", { robots: "noindex, noarchive", description: "Test a purchase against your cash plan." });
    page = <ScenariosPage />;
    break;
  case "/app/reviews":
    document.body.className = "app-page";
    setPageMetadata("Reviews | Finvayo", "#f2efe8", { robots: "noindex, noarchive", description: "Complete weekly cash reviews and payment follow-ups." });
    page = <ReviewsPage />;
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

createRoot(root).render(<StrictMode><Suspense fallback={<div className="grid min-h-svh place-items-center bg-background text-sm text-muted-foreground">Loading Finvayo...</div>}>{page}</Suspense></StrictMode>);
