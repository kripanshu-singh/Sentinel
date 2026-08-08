# Sentinel — Reusable Demonstration Prompts

This document lists ready-to-run prompts for showcasing Sentinel's site-agnostic e-commerce capabilities, dynamic search URL resolution, price extraction, variance monitoring, and Human-in-the-Loop (HITL) guardrails.

---

## 1. 🛡️ Single-Product Price Audit with HITL Guard (eBay)

> **Prompt**: `Find the price of Sony WH-1000XM5 Noise-Canceling Headphones on eBay and verify that the unit price does not exceed $250.`
> - **Target Unit Price**: `250.00`
> - **Variance Threshold**: `0%`
> - **Expected Behavior**: Direct search navigation to eBay (`_nkw=Sony+WH-1000XM5`). Extracts live price (~$320) and triggers the **Variance Alert HITL Panel** live on screen.

---

## 2. 🛒 International Currency & Retailer Audit (Flipkart)

> **Prompt**: `Find the price of boAt Rockerz 450 Bluetooth Headphone on Flipkart and check if it is under ₹1,500.`
> - **Target Unit Price**: `1500.00`
> - **Variance Threshold**: `10%`
> - **Expected Behavior**: Direct search navigation to Flipkart (`?q=boAt+Rockerz+450`). Extracts live price in Rupees (`₹`) and checks budget limit.

---

## 3. ⚡ Tech Search & Price Extraction (Amazon)

> **Prompt**: `Find the price of Logitech M185 Wireless Mouse on Amazon and verify if it is under $20.`
> - **Target Unit Price**: `20.00`
> - **Variance Threshold**: `10%`
> - **Expected Behavior**: Direct search navigation to Amazon (`?k=Logitech+M185`). Extracts live market price and drafts summary report.

---

## 4. 🎮 Gaming Console & Media Check (Best Buy)

> **Prompt**: `Find the price of PlayStation 5 Digital Edition Console on Best Buy and check if it is under $450.`
> - **Target Unit Price**: `450.00`
> - **Variance Threshold**: `10%`
> - **Expected Behavior**: Direct search navigation to Best Buy (`?st=PlayStation+5+Digital+Edition`). Extracts live gaming console pricing.

---

## 5. 🏆 Full Procurement & Coupon Workflow (SauceDemo)

> **Prompt**: `Procure the 'Sauce Labs Backpack' and 'Sauce Labs Fleece Jacket' from https://www.saucedemo.com/. Apply discount code 'SAVE10' and verify subtotal is under $75.00.`
> - **Storefront URL**: `https://www.saucedemo.com/`
> - **Credentials**: `standard_user` / `secret_sauce`
> - **Discount Code**: `SAVE10`
> - **Target Subtotal**: `75.00`
> - **Variance Threshold**: `10%`
> - **Expected Behavior**: Full B2B purchasing run — login form filling, multi-item carting, coupon validation, human approval pause, and CSV invoice output.
