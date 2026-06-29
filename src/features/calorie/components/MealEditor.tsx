import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "../../../shared/components/Button";
import { colors } from "../../../shared/theme/colors";
import {
  formatNumber,
  numberToInput,
  parseNumberInput,
  sanitizeDecimalInput,
} from "../../../shared/utils/format";
import { type FoodAnalysis, mealTotals } from "../schema/foodAnalysis";

/**
 * The reusable meal-editing form. A meal is a list of ingredient rows — name +
 * calories + macros — and the card's total is the live sum of those rows
 * (`mealTotals`), so editing a row reflows the total with no chance of the parts
 * disagreeing with the whole.
 *
 * Self-contained and atom-free: it holds the edits in local string buffers (so a
 * half-typed "12." survives a re-render) seeded once from `meal`, and emits the
 * finished `FoodAnalysis` through `onSave`. The caller decides what saving means
 * — append a new entry (fresh result) or update an existing one (saved log).
 */

type RowBuffer = {
  key: string;
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
};

type Form = {
  foodName: string;
  rows: RowBuffer[];
};

let rowCounter = 0;
function nextRowKey(): string {
  rowCounter += 1;
  return `row-${rowCounter}`;
}

function seedForm(meal: FoodAnalysis): Form {
  return {
    foodName: meal.foodName,
    rows: meal.ingredients.map((item) => ({
      key: nextRowKey(),
      name: item.name,
      calories: numberToInput(item.calories),
      protein: numberToInput(item.macros.protein),
      carbs: numberToInput(item.macros.carbs),
      fat: numberToInput(item.macros.fat),
    })),
  };
}

function emptyRow(): RowBuffer {
  return { key: nextRowKey(), name: "", calories: "", protein: "", carbs: "", fat: "" };
}

function formToMeal(form: Form, base: FoodAnalysis): FoodAnalysis {
  return {
    ...base,
    foodName: form.foodName.trim(),
    ingredients: form.rows.map((row) => ({
      name: row.name.trim(),
      calories: parseNumberInput(row.calories),
      macros: {
        protein: parseNumberInput(row.protein),
        carbs: parseNumberInput(row.carbs),
        fat: parseNumberInput(row.fat),
      },
    })),
  };
}

type MealEditorProps = {
  meal: FoodAnalysis;
  title: string;
  saveLabel: string;
  onSave: (meal: FoodAnalysis) => void;
  onCancel?: () => void;
};

export function MealEditor({ meal, title, saveLabel, onSave, onCancel }: MealEditorProps) {
  const [form, setForm] = useState<Form>(() => seedForm(meal));

  function setRowField(key: string, field: keyof Omit<RowBuffer, "key">, value: string) {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    }));
  }

  function addRow() {
    setForm((prev) => ({ ...prev, rows: [...prev.rows, emptyRow()] }));
  }

  function removeRow(key: string) {
    setForm((prev) => ({ ...prev, rows: prev.rows.filter((row) => row.key !== key) }));
  }

  const totals = mealTotals(formToMeal(form, meal).ingredients);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>

      <View style={styles.dishField}>
        <Text style={styles.dishLabel}>Meal</Text>
        <TextInput
          value={form.foodName}
          onChangeText={(text) => setForm((prev) => ({ ...prev, foodName: text }))}
          placeholder="Name this meal"
          placeholderTextColor={colors.textMuted}
          style={styles.dishInput}
        />
      </View>

      <Text style={styles.sectionLabel}>Ingredients</Text>
      {form.rows.map((row) => (
        <IngredientRow
          key={row.key}
          row={row}
          onChange={(field, value) => setRowField(row.key, field, value)}
          onRemove={() => removeRow(row.key)}
        />
      ))}

      <Pressable onPress={addRow} style={styles.addRow} accessibilityRole="button">
        <Text style={styles.addRowText}>＋ Add ingredient</Text>
      </Pressable>

      <View style={styles.total}>
        <Text style={styles.totalCalories}>{formatNumber(totals.calories)} kcal</Text>
        <Text style={styles.totalMacros}>
          Protein {formatNumber(totals.macros.protein)}g · Carbs{" "}
          {formatNumber(totals.macros.carbs)}g · Fat {formatNumber(totals.macros.fat)}g
        </Text>
      </View>

      {meal.notes ? <Text style={styles.notes}>{meal.notes}</Text> : null}

      <View style={styles.actions}>
        {onCancel ? (
          <Button
            label="Cancel"
            variant="secondary"
            onPress={onCancel}
            style={styles.actionButton}
          />
        ) : null}
        <Button label={saveLabel} onPress={() => onSave(formToMeal(form, meal))} style={styles.actionButton} />
      </View>
    </View>
  );
}

type IngredientRowProps = {
  row: RowBuffer;
  onChange: (field: keyof Omit<RowBuffer, "key">, value: string) => void;
  onRemove: () => void;
};

function IngredientRow({ row, onChange, onRemove }: IngredientRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <TextInput
          value={row.name}
          onChangeText={(text) => onChange("name", text)}
          placeholder="Ingredient"
          placeholderTextColor={colors.textMuted}
          style={styles.nameInput}
        />
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${row.name || "ingredient"}`}
        >
          <Text style={styles.removeText}>✕</Text>
        </Pressable>
      </View>
      <View style={styles.macroRow}>
        <MacroInput label="kcal" value={row.calories} onChangeText={(t) => onChange("calories", t)} />
        <MacroInput label="P (g)" value={row.protein} onChangeText={(t) => onChange("protein", t)} />
        <MacroInput label="C (g)" value={row.carbs} onChangeText={(t) => onChange("carbs", t)} />
        <MacroInput label="F (g)" value={row.fat} onChangeText={(t) => onChange("fat", t)} />
      </View>
    </View>
  );
}

type MacroInputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
};

function MacroInput({ label, value, onChangeText }: MacroInputProps) {
  return (
    <View style={styles.macroField}>
      <Text style={styles.macroLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(text) => onChangeText(sanitizeDecimalInput(text))}
        keyboardType="decimal-pad"
        inputMode="decimal"
        placeholder="—"
        placeholderTextColor={colors.textMuted}
        style={styles.macroInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  dishField: {
    gap: 6,
  },
  dishLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
  dishInput: {
    fontSize: 16,
    color: colors.text,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
    marginTop: 4,
  },
  row: {
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  nameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    minHeight: 36,
  },
  removeText: {
    fontSize: 16,
    color: colors.textMuted,
    paddingHorizontal: 4,
  },
  macroRow: {
    flexDirection: "row",
    gap: 8,
  },
  macroField: {
    flex: 1,
    gap: 4,
  },
  macroLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: "center",
  },
  macroInput: {
    fontSize: 15,
    color: colors.text,
    minHeight: 40,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: "center",
  },
  addRow: {
    paddingVertical: 8,
    alignItems: "center",
  },
  addRowText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
  },
  total: {
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalCalories: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  totalMacros: {
    fontSize: 14,
    color: colors.textMuted,
  },
  notes: {
    fontSize: 14,
    color: colors.textMuted,
    fontStyle: "italic",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
});
