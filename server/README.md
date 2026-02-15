Stripe Checkout demo server
==========================

Quick start

1. Install dependencies:

   cd server
   npm install

2. Set environment variables:

   export STRIPE_SECRET_KEY=sk_test_...
   export BASE_URL=https://your-public-domain.com

3. Start the server:

   npm start

4. Configure Stripe webhook:

   In Stripe Dashboard -> Developers -> Webhooks, add endpoint:
     https://your-public-domain.com/webhook
   Use the raw body and sign the webhook if you like. (This demo currently parses JSON body directly.)

Endpoints
- POST /create-checkout-session { email } -> returns { url } (redirect user to that URL)
- POST /webhook -> Stripe webhook; on checkout.session.completed it creates a license code
- POST /verify-code { code } -> validates a code and marks it used

Notes
- This is a minimal demo for local testing. For production:
  - Use HTTPS and verified webhooks with signature verification.
  - Store license records in a proper database.
  - Send the license code to the customer by email (or show on success page).

