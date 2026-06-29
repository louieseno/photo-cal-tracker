import { StatusBar } from "expo-status-bar";
import { Provider } from "jotai";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CalorieScreen } from "./src/features/calorie/screens/CalorieScreen";

export default function App() {
  return (
    <SafeAreaProvider>
      <Provider>
        <StatusBar style="auto" />
        <CalorieScreen />
      </Provider>
    </SafeAreaProvider>
  );
}
