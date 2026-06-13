function calculateBmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const heightM = Number(heightCm) / 100;
  return Number((Number(weightKg) / (heightM * heightM)).toFixed(2));
}

function getBmiCategory(bmi) {
  if (!bmi) return null;
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

module.exports = {
  calculateBmi,
  getBmiCategory
};
