import { Suspense } from "react";
import LoginClient from "./login-client";

export default function LoginRoute() {
  return (
    <Suspense fallback={null}>
      <LoginClient />
    </Suspense>
  );
}
