import type { GlossaryEntry } from "./types";

/**
 * CityLab Medical Glossary — 2_medical_glossary.md
 * Written in 8th-grade plain language.
 * Strictly educational: never provides diagnosis.
 */
export const GLOSSARY: GlossaryEntry[] = [
  {
    id: "hemoglobin",
    term: "Hemoglobin",
    aka: ["Hb", "Hgb", "Haemoglobin"],
    category: "Blood Count",
    simple: "Hemoglobin is a special iron-rich protein in red blood cells that carries oxygen from your lungs to every part of your body.",
    whyPerformed: "It is checked to see if your blood has enough healthy oxygen-carrying cells.",
  },
  {
    id: "wbc",
    term: "White Blood Cell Count",
    aka: ["WBC", "Leukocytes", "Total Leukocyte Count"],
    category: "Blood Count",
    simple: "White blood cells are your body's defense soldiers. They help protect you by fighting off bacteria and infections.",
    whyPerformed: "Doctors check this count to see how actively your body's immune defense system is working.",
  },
  {
    id: "platelets",
    term: "Platelet Count",
    aka: ["PLT", "Platelets", "Thrombocytes"],
    category: "Blood Count",
    simple: "Platelets are tiny disc-shaped cell fragments in blood that stick together like a plug to stop bleeding when you have a scratch.",
    whyPerformed: "Checked to make sure your blood can form normal clots to stop bleeding when needed.",
  },
  {
    id: "rbc",
    term: "Red Blood Cell Count",
    aka: ["RBC", "Erythrocytes"],
    category: "Blood Count",
    simple: "Red blood cells are the microscopic vehicles that carry oxygen throughout your body using hemoglobin.",
    whyPerformed: "Part of a complete blood count to understand total red cell volume.",
  },
  {
    id: "glucose",
    term: "Fasting Blood Sugar",
    aka: ["FBS", "Glucose", "Blood Glucose"],
    category: "Biochemistry",
    simple: "Fasting Blood Sugar measures the amount of glucose (fuel sugar) floating in your bloodstream after not eating overnight.",
    whyPerformed: "Shows how smoothly your body balances and uses sugar for energy.",
  },
  {
    id: "alt",
    term: "ALT",
    aka: ["SGPT", "Alanine Aminotransferase"],
    category: "Liver Enzymes",
    simple: "ALT is a helpful enzyme found mostly inside liver cells. When liver cells are irritated or busy, more ALT can spill into the blood.",
    whyPerformed: "Helps doctors evaluate how well the liver cells are holding up.",
  },
  {
    id: "ast",
    term: "AST",
    aka: ["SGOT", "Aspartate Aminotransferase"],
    category: "Liver Enzymes",
    simple: "AST is an enzyme found in liver cells, heart, and muscle tissue. It is usually evaluated side-by-side with ALT.",
    whyPerformed: "Used alongside ALT to check for stress or irritation in liver cells.",
  },
  {
    id: "cholesterol",
    term: "Cholesterol",
    aka: ["Total Cholesterol", "Lipids"],
    category: "Lipid Profile",
    simple: "Cholesterol is a waxy, lipid fat substance that your body uses to build cell walls and make necessary hormones.",
    whyPerformed: "Helps understand how fats circulate through your blood vessels.",
  },
  {
    id: "tsh",
    term: "TSH",
    aka: ["Thyroid-Stimulating Hormone"],
    category: "Endocrinology",
    simple: "TSH is a messenger hormone sent from the pituitary gland to tell your neck thyroid gland how fast or slow to run your body's engine.",
    whyPerformed: "Checked to verify thyroid activity and energy regulation.",
  },
  {
    id: "urine-ph",
    term: "Urine pH",
    aka: ["pH Level", "Acidity"],
    category: "Urinalysis",
    simple: "Urine pH measures how acidic or basic your urine is on a standard scale from 1 to 14.",
    whyPerformed: "Reflects how your kidneys maintain chemical balance and manage acids.",
  },
  {
    id: "urine-protein",
    term: "Urine Protein",
    aka: ["Protein", "Albuminuria"],
    category: "Urinalysis",
    simple: "Checks whether protein is leaking into urine. Normally, kidneys filter blood so cleanly that protein stays in the body.",
    whyPerformed: "Verifies that the tiny filters in the kidneys are functioning cleanly.",
  },
];

export const GLOSSARY_BY_ID: Record<string, GlossaryEntry> = Object.fromEntries(
  GLOSSARY.map((g) => [g.id, g]),
);
