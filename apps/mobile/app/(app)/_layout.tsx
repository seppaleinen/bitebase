import { Tabs } from "expo-router";
import { LayoutDashboard, BookOpen } from "lucide-react-native";

export default function AppTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#7c3aed",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: {
          borderTopColor: "#f3f4f6",
          backgroundColor: "#ffffff",
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Learn",
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="onboarding"
        options={{
          title: "New Course",
          tabBarIcon: ({ color, size }) => (
            <BookOpen color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
