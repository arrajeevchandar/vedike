import "server-only";
import { Env, StandardCheckoutClient, StandardCheckoutPayRequest, RefundRequest } from "@phonepe-pg/pg-sdk-node";
import { VOTE_PRICE_PAISE } from "@/lib/domain";

let client: StandardCheckoutClient | null = null;

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function hasPhonePeConfig() {
  return Boolean(process.env.PHONEPE_CLIENT_ID && process.env.PHONEPE_CLIENT_SECRET && process.env.PHONEPE_MERCHANT_ID);
}

export function getPhonePeClient() {
  if (!client) {
    const env = process.env.PHONEPE_ENV === "PRODUCTION" ? Env.PRODUCTION : Env.SANDBOX;
    client = StandardCheckoutClient.getInstance(required("PHONEPE_CLIENT_ID"), required("PHONEPE_CLIENT_SECRET"), Number(process.env.PHONEPE_CLIENT_VERSION ?? "1"), env, false);
  }
  return client;
}

export async function createPhonePeOrder(input: { merchantOrderId: string; redirectUrl: string; voterPhone: string }) {
  const request = StandardCheckoutPayRequest.builder()
    .merchantOrderId(input.merchantOrderId)
    .amount(VOTE_PRICE_PAISE)
    .redirectUrl(input.redirectUrl)
    .message("One Vedike community vote")
    .expireAfter(900)
    .disablePaymentRetry(false)
    .build();
  return getPhonePeClient().pay(request);
}

export async function getPhonePeOrderStatus(merchantOrderId: string) {
  return getPhonePeClient().getOrderStatus(merchantOrderId, false);
}

export function validatePhonePeCallback(authorization: string, body: string) {
  return getPhonePeClient().validateCallback(required("PHONEPE_WEBHOOK_USERNAME"), required("PHONEPE_WEBHOOK_PASSWORD"), authorization, body);
}

export async function refundPhonePeOrder(merchantOrderId: string, merchantRefundId: string) {
  const request = RefundRequest.builder().merchantRefundId(merchantRefundId).originalMerchantOrderId(merchantOrderId).amount(VOTE_PRICE_PAISE).build();
  return getPhonePeClient().refund(request);
}
