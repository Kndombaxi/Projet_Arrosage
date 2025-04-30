import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    router.push("./login");
  }, [router]);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}