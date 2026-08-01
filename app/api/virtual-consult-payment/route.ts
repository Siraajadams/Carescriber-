const session = await stripe.checkout.sessions.create({
  mode: "payment",

  line_items: [
    {
      price_data: {
        currency: "zar",
        product_data: {
          name: "Virtual GP Consultation",
          description: `SymptomAI referral ${referralCode}`,
        },
        unit_amount: 25000,
      },
      quantity: 1,
    },
  ],

  metadata: {
    referralCode: referralCode || "",
    consentToken: consentToken || "",
    consultationReason: consultationReason || "",
    patientId: patientId || "",
    patientName: patientName || "",
    patientFirstName: patientFirstName || "",
    patientSurname: patientSurname || "",
  },

  success_url:
    `${appUrl}/?payment=success` +
    `&session_id={CHECKOUT_SESSION_ID}` +
    `&referral_code=${encodeURIComponent(referralCode)}`,

  cancel_url:
    `${appUrl}/?payment=cancelled` +
    `&referral_code=${encodeURIComponent(referralCode)}`,
});
