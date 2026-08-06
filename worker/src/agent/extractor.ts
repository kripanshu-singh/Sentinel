/**
 * worker/src/agent/extractor.ts
 *
 * LLM-powered structured data extraction from HTML DOM snapshots.
 * Extracts pricing, inventory, discount details, and line items.
 */

import { getLLMProvider, parseModelJSON } from "../llm/client.js";
import type { ExtractedProduct } from "./rule-engine.js";
import type { LineItem, ChannelSnapshot } from "../types/index.js";

const EXTRACT_PRODUCT_SYSTEM_PROMPT = `You are a B2B storefront data extraction agent.
Read the raw HTML snippet or page text and extract details about the primary product matching the user's intent.

Extract:
- sku: Product code / SKU.
- description: Title/name of the product.
- unitPrice: Number representing unit price (e.g. 4.80).
- discountApplied: Fraction representing discount (e.g. 0.1 for 10% off, 0 if none).
- couponApplied: Boolean indicating if a coupon is active.
- inventoryAvailable: Number indicating stock count. Default to 999 if not specified.
- quantityRequested: Number of units requested. Default to 1.
- confidence: Number 0..1 estimating how reliable this extraction is. Lower it
  when fields are missing, ambiguous, or the page looks like the wrong product.

Output ONLY a valid JSON object matching the requested schema. No prose, no markdown code blocks.`;

const EXTRACT_PRODUCT_SCHEMA = {
  type: "object",
  properties: {
    sku: { type: "string" },
    description: { type: "string" },
    unitPrice: { type: "number" },
    discountApplied: { type: "number" },
    couponApplied: { type: "boolean" },
    inventoryAvailable: { type: "number" },
    quantityRequested: { type: "number" },
    confidence: { type: "number" },
  },
  required: ["sku", "description", "unitPrice", "discountApplied", "couponApplied", "inventoryAvailable", "quantityRequested", "confidence"],
};

const EXTRACT_INVOICE_SYSTEM_PROMPT = `You are a B2B order review extractor.
Read the checkout review HTML and extract all line items in the cart, discrepancy details, and competitor comparisons.

Output ONLY a valid JSON object containing:
- items: Array of line items: sku, description, quantity, unitPrice, lineTotal, discounts.
- channels: Array of channel/store comparisons: channel, price, discount, shipping, computedMargin.
- summary: Human-readable paragraph summarizing the overall order state, pricing variances, and coupon applications.`;

const EXTRACT_INVOICE_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sku: { type: "string" },
          description: { type: "string" },
          quantity: { type: "integer" },
          unitPrice: { type: "number" },
          lineTotal: { type: "number" },
          discounts: { type: "number" },
        },
        required: ["sku", "description", "quantity", "unitPrice", "lineTotal", "discounts"],
      },
    },
    channels: {
      type: "array",
      items: {
        type: "object",
        properties: {
          channel: { type: "string" },
          price: { type: "number" },
          discount: { type: "number" },
          shipping: { type: "number" },
          computedMargin: { type: "number" },
        },
        required: ["channel", "price", "discount", "shipping", "computedMargin"],
      },
    },
    summary: { type: "string" },
  },
  required: ["items", "summary"],
};

export interface ProductExtraction {
  product: ExtractedProduct;
  confidence: number; // 0..1
}

export async function extractProductFromDOM(
  html: string,
  targetProductName: string
): Promise<ProductExtraction> {
  const llm = getLLMProvider();
  
  // Truncate html to roughly 24k chars to stay safe with LLM context limit
  const truncatedHtml = html.slice(0, 24000);

  const userPrompt = `
Target Product Name: ${targetProductName}
HTML Content:
${truncatedHtml}
  `.trim();

  const text = await llm.generate(
    [
      { role: "system", content: EXTRACT_PRODUCT_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    { responseSchema: EXTRACT_PRODUCT_SCHEMA, temperature: 0.1 }
  );

  const data = parseModelJSON<ExtractedProduct & { confidence?: number }>(text);
  const confidence =
    typeof data.confidence === "number"
      ? Math.min(1, Math.max(0, data.confidence))
      : 0.5;

  return { product: data, confidence };
}

export interface ExtractedInvoice {
  items: LineItem[];
  channels?: ChannelSnapshot[];
  summary: string;
}

export async function extractInvoiceFromDOM(html: string): Promise<ExtractedInvoice> {
  const llm = getLLMProvider();
  const truncatedHtml = html.slice(0, 30000);

  const text = await llm.generate(
    [
      { role: "system", content: EXTRACT_INVOICE_SYSTEM_PROMPT },
      { role: "user", content: truncatedHtml },
    ],
    { responseSchema: EXTRACT_INVOICE_SCHEMA, temperature: 0.1 }
  );

  const data = parseModelJSON<ExtractedInvoice>(text);
  
  // Set default status for line items
  if (data.items) {
    data.items = data.items.map((item) => ({
      ...item,
      status: item.status ?? "ok",
    }));
  }

  return data;
}
