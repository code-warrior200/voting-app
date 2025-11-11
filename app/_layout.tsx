import { useEffect, useState } from 'react';
import { Slot } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    // Add any custom fonts here if needed
  });
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Wait for fonts to load
        if (loaded || error) {
          // Optional: Add a minimum delay to show splash screen
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
        // Hide the splash screen once the app is ready
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, [loaded, error]);

  if (!appIsReady) {
    return null;
  }

  return <Slot />;
}

