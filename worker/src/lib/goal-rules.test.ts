import test from "node:test";
import assert from "node:assert/strict";
import { extractTargetPrice, extractTargetSubtotal, extractQuantityForProduct } from "./goal-rules.js";

test("extracts target subtotal correctly", () => {
  const goal1 = "Procure the Fleece Jacket and Bike Light. Verify combined subtotal does not exceed $50.00. Pause if variance > 10%.";
  const subtotal1 = extractTargetSubtotal(goal1);
  assert.equal(subtotal1, 50.00);

  const goal2 = "Add items. If the total goes above $40, stop and ask me.";
  const subtotal2 = extractTargetSubtotal(goal2);
  assert.equal(subtotal2, 40.00);

  const goal3 = "Simple purchase under $20.";
  const subtotal3 = extractTargetSubtotal(goal3);
  assert.equal(subtotal3, undefined);
});

test("extracts target unit price correctly and ignores subtotal targets", () => {
  const goal1 = "Procure the Fleece Jacket and Bike Light. Verify combined subtotal does not exceed $50.00. Pause if variance > 10%.";
  const price1 = extractTargetPrice(goal1);
  assert.equal(price1, undefined); // Should not match the $50 subtotal limit as unit price!

  const goal2 = "Login to the store, check the price of backpack. If the price is higher than $25, pause and ask.";
  const price2 = extractTargetPrice(goal2);
  assert.equal(price2, 25.00);

  const goal3 = "Check backpack price under $25, and keep combined subtotal under $100.";
  const price3 = extractTargetPrice(goal3);
  const subtotal3 = extractTargetSubtotal(goal3);
  assert.equal(price3, 25.00);
  assert.equal(subtotal3, 100.00);
});

test("extracts per-product quantities in multi-product goals", () => {
  const goal =
    "Build a cart with 5 units of Sauce Labs Backpack and 10 units of Sauce Labs Fleece Jacket.";
  assert.equal(extractQuantityForProduct(goal, "Sauce Labs Backpack"), 5);
  assert.equal(extractQuantityForProduct(goal, "Sauce Labs Fleece Jacket"), 10);
  // Whole-word matching: "Backpack" must not steal "Sauce Labs Backpack"'s 5.
  assert.equal(extractQuantityForProduct(goal, "Backpack"), 1);

  assert.equal(extractQuantityForProduct("Buy 3 Fleece Jacket and 2 Bike Light", "Fleece Jacket"), 3);
  assert.equal(extractQuantityForProduct("Buy 3 Fleece Jacket and 2 Bike Light", "Bike Light"), 2);

  assert.equal(extractQuantityForProduct("Add a Backpack", "Backpack"), 1);
  assert.equal(extractQuantityForProduct("", "Backpack"), 1);
  assert.equal(extractQuantityForProduct("Any goal", undefined), 1);
});
