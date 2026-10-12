// Validates Zambian phone numbers:
// Accepts: +2609XXXXXXX, 09XXXXXXX, 07XXXXXXX
// Zamtel: 095 — Airtel: 097, 077 — MTN: 076, 096
export const isValidZambianPhone = (phone) =>
    /^(\+260|0)(9[5-7]|7[6-9])\d{7}$/.test(phone.trim());
  
  // Normalize to +260 format for storage
  export const normalizePhone = (phone) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('260')) return `+${digits}`;
    if (digits.startsWith('0')) return `+260${digits.slice(1)}`;
    return `+260${digits}`;
  };
  
export const NEIGHBOURHOODS = [
  'Kalingalinga', 'Kanyama', 'Mtendere', 'Chilenje',
  'Matero', 'Bauleni', 'Chelstone', 'Woodlands',
  'Kabwata', 'Libala', 'Lusaka_CBD', 'Munali', 'Roma',
  'Lima', 'Mandevu', 'Makeni', 'Chawama', 'Feira',
  'Kafue West', 'Kafue South', 'Chongwe East', 'Chongwe West',
  'Chilanga South', 'Chilanga North', 'Other',
];
