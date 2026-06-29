import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useAtom } from "jotai";
import { colors } from "../../../shared/theme/colors";
import { formatNumber } from "../../../shared/utils/format";
import { type FoodAnalysis, mealTotals } from "../schema/foodAnalysis";
import { savedAtom } from "../state/atoms";
import { MealEditor } from "./MealEditor";

/**
 * The in-memory saved log (no DB, as specified). Each row shows the meal name +
 * its rolled-up calories, and can be edited in place — reusing the same
 * `MealEditor` as the fresh result — or deleted. Newest first. Editing one row
 * at a time keeps the screen calm; the expanded editor replaces the row.
 */
export function SavedMeals() {
  const [saved, setSaved] = useAtom(savedAtom);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (saved.length === 0) return null;

  function applyEdit(id: string, meal: FoodAnalysis) {
    setSaved((list) => list.map((entry) => (entry.id === id ? { ...meal, id } : entry)));
    setEditingId(null);
  }

  function confirmDelete(id: string, name: string) {
    Alert.alert("Delete meal?", `Remove "${name || "this meal"}" from your log?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setSaved((list) => list.filter((entry) => entry.id !== id));
          setEditingId((current) => (current === id ? null : current));
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Saved meals ({saved.length})</Text>

      {saved.map((meal) =>
        editingId === meal.id ? (
          <MealEditor
            key={meal.id}
            meal={meal}
            title="Edit meal"
            saveLabel="Update"
            onSave={(updated) => applyEdit(meal.id, updated)}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <View key={meal.id} style={styles.row}>
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={1}>
                {meal.foodName || "Unnamed meal"}
              </Text>
              <Text style={styles.cals}>
                {formatNumber(mealTotals(meal.ingredients).calories)} kcal
              </Text>
            </View>
            <View style={styles.actions}>
              <Pressable onPress={() => setEditingId(meal.id)} hitSlop={6} accessibilityRole="button">
                <Text style={styles.edit}>Edit</Text>
              </Pressable>
              <Pressable
                onPress={() => confirmDelete(meal.id, meal.foodName)}
                hitSlop={6}
                accessibilityRole="button"
              >
                <Text style={styles.delete}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingTop: 8,
  },
  heading: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  cals: {
    fontSize: 13,
    color: colors.textMuted,
  },
  actions: {
    flexDirection: "row",
    gap: 16,
  },
  edit: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
  },
  delete: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.danger,
  },
});
