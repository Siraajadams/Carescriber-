const { data, error } = await supabase
  .from("symptomai_referrals")
  .select(`
    id,
    referral_code,
    consent_token,
    consultation_reason,
    patient_first_name,
    patient_surname,
    patient_id,
    payment_status,
    queue_status,
    assigned_doctor_id,
    assigned_doctor_name,
    accepted_at,
    completed_at,
    created_at,
    paid_at
  `)
  .eq("payment_status", "paid")
  .in("queue_status", ["waiting", "accepted"])
  .order("created_at", { ascending: true });
