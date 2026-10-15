
function cleanText(value, maxLength = 180) {
  if (value === undefined || value === null) {
    return "Unknown / not provided";
  }

  const text = String(value)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text ? text.slice(0, maxLength) : "Unknown / not provided";
}

function formatMedicalField(value, label) {
  if (Array.isArray(value)) {
    value = value.join(", ");
  }

  const cleaned = cleanText(value);

  if (cleaned === "Unknown / not provided") {
    return `${label}: Unknown / not provided`;
  }

  return `${label}: ${cleaned}`;
}

function buildOfflineEmergencyText({
  user,
  profile,
  contacts = [],
  qrCodeId = ""
}) {
  const safeContacts = (
    Array.isArray(contacts) && contacts.length > 0
      ? contacts
      : profile?.emergencyContacts || []
  )
    .slice(0, 2)
    .map((contact, index) => {
      const name = cleanText(contact.name, 80);
      const phone = cleanText(contact.phone, 30);
      const relationship = cleanText(
        contact.relationship,
        50
      );

      return [
        `Contact ${index + 1}: ${name}`,
        `Phone: ${phone}`,
        `Relationship: ${relationship}`
      ].join("\n");
    });

  const name = cleanText(user?.name, 100);
  const age =
    profile?.age !== undefined &&
    profile?.age !== null &&
    profile?.age !== ""
      ? cleanText(profile.age, 3)
      : "Unknown / not provided";

  const bloodGroup = cleanText(profile?.bloodGroup, 10);

  const generatedAt = new Date().toISOString();
  const profileUpdatedAt =
    profile?.updatedAt || profile?.createdAt || null;

  const reviewedDate = profileUpdatedAt
    ? new Date(profileUpdatedAt)
    : null;

  const validReviewedDate =
    reviewedDate && !Number.isNaN(reviewedDate.getTime())
      ? reviewedDate.toISOString().slice(0, 10)
      : "Unknown";

  return [
    "LIFEQR OFFLINE EMERGENCY SUMMARY",
    "IMPORTANT: THIS IS A STORED SNAPSHOT, NOT A LIVE RECORD.",
    "Information may be outdated. Verify clinically.",
    "Patient-reported information unless independently verified.",
    "",
    `Patient: ${name}`,
    `LifeQR ID: ${cleanText(qrCodeId, 50)}`,
    `Age: ${age}`,
    `Reported blood group: ${bloodGroup}`,
    formatMedicalField(profile?.allergies, "Allergies"),
    formatMedicalField(
      profile?.healthIssues,
      "Medical conditions"
    ),
    formatMedicalField(
      profile?.medications,
      "Current medications"
    ),
    "",
    "EMERGENCY CONTACTS",
    safeContacts.length
      ? safeContacts.join("\n\n")
      : "No emergency contact information provided",
    "",
    `Profile last updated: ${validReviewedDate}`,
    `QR snapshot generated: ${generatedAt}`
  ].join("\n");
}

module.exports = {
  buildOfflineEmergencyText
};
