/**
 * Demo mode data — pre-cached responses for ?demo=1 replay.
 * This enables the Vercel backup to work without a running backend.
 */

import type { PageData, AskResponse } from "./api";

export const DEMO_PAGES: PageData[] = [
  {
    page_id: "demo_p1",
    page_number: 1,
    text: "Chapter 3: The Plant Cell\n\n3.1 Cell Wall\nThe plant cell wall is composed of cellulose microfibrils. It provides structural support and protection.\n\nThe cell membrane lies just inside the cell wall. It is selectively permeable, controlling what enters and exits.\n\nThe cytoplasm contains various organelles including:\n- Chloroplasts (photosynthesis)\n- Mitochondria (cellular respiration)\n- Ribosomes (protein synthesis)\n- Endoplasmic reticulum (transport)",
    headings: [
      { level: 1, text: "Chapter 3: The Plant Cell" },
      { level: 2, text: "3.1 Cell Wall" },
    ],
    diagrams: [
      {
        id: "fig_3_1",
        label: "Fig. 3.1: Plant Cell Diagram",
        description:
          "A simplified cross-section of a typical plant cell showing the cell wall (outermost), cell membrane, cytoplasm with chloroplasts and mitochondria, and a large central vacuole. The nucleus is visible on the upper-right.",
        labels: ["cell wall", "cell membrane", "cytoplasm", "nucleus", "vacuole"],
      },
    ],
    captions: ["Fig. 3.1: A typical plant cell showing major organelles."],
    narration_text:
      "Page 1.\n\nThis page is about: Chapter 3: The Plant Cell.\n\nThe plant cell wall is composed of cellulose microfibrils...",
  },
  {
    page_id: "demo_p2",
    page_number: 2,
    text: "3.2 Ribosomes and Endoplasmic Reticulum\nRibosomes are the sites of protein synthesis. They can be found free in the cytoplasm or attached to the endoplasmic reticulum. Ribosomes translate mRNA into polypeptide chains.\n\nThe rough endoplasmic reticulum (RER) has ribosomes on its surface and is involved in protein processing and transport. The smooth endoplasmic reticulum (SER) lacks ribosomes and is involved in lipid synthesis.",
    headings: [{ level: 2, text: "3.2 Ribosomes and Endoplasmic Reticulum" }],
    diagrams: [],
    captions: [],
    narration_text:
      "Page 2.\n\nThis page is about: 3.2 Ribosomes and Endoplasmic Reticulum.\n\nRibosomes are the sites of protein synthesis...",
  },
  {
    page_id: "demo_p3",
    page_number: 3,
    text: "3.3 Mitochondria\nMitochondria are the powerhouse of the cell. They perform cellular respiration, converting glucose and oxygen into ATP (adenosine triphosphate).\n\nEach mitochondrion has a double membrane:\n- Outer membrane: smooth, permeable to small molecules\n- Inner membrane: folded into cristae, site of ATP synthesis\n- Matrix: contains enzymes for the Krebs cycle",
    headings: [{ level: 2, text: "3.3 Mitochondria" }],
    diagrams: [
      {
        id: "fig_3_2",
        label: "Fig. 3.2: Mitochondrion structure",
        description:
          "A cross-section of a mitochondrion showing the smooth outer membrane, the inner membrane folded into cristae, the matrix interior, and the intermembrane space.",
        labels: ["outer membrane", "inner membrane", "cristae", "matrix"],
      },
    ],
    captions: ["Fig. 3.2: Structure of a mitochondrion."],
    narration_text:
      "Page 3.\n\nThis page is about: 3.3 Mitochondria.\n\nMitochondria are the powerhouse of the cell...",
  },
];

export const DEMO_ANSWERS: Record<string, AskResponse> = {
  "what is the cell wall made of": {
    answer:
      "The plant cell wall is composed of cellulose microfibrils [page 1]. It provides structural support and protection to the cell.",
    citations: [{ page: 1 }],
    not_in_book: false,
    pages_used: [1, 2, 3],
  },
  "what is a ribosome": {
    answer:
      "Ribosomes are the sites of protein synthesis [page 2]. They translate mRNA into polypeptide chains. They can be found free in the cytoplasm or attached to the endoplasmic reticulum [page 2].",
    citations: [{ page: 2 }],
    not_in_book: false,
    pages_used: [1, 2, 3],
  },
  "what is the structure of a mitochondrion": {
    answer:
      "A mitochondrion has a double membrane [page 3]. The outer membrane is smooth and permeable to small molecules. The inner membrane is folded into structures called cristae, which are the site of ATP synthesis. The interior is called the matrix, which contains enzymes for the Krebs cycle [page 3].",
    citations: [{ page: 3 }],
    not_in_book: false,
    pages_used: [1, 2, 3],
  },
  "who won the election": {
    answer: "This isn't covered in the captured pages.",
    citations: [],
    not_in_book: true,
    pages_used: [1, 2, 3],
  },
};

export function findDemoAnswer(question: string): AskResponse {
  const q = question.toLowerCase().trim();
  for (const [key, answer] of Object.entries(DEMO_ANSWERS)) {
    if (q.includes(key)) return answer;
  }
  // Fuzzy match: if question contains biology terms found in pages
  const bioTerms = ["cell", "wall", "ribosome", "mitochondri", "membrane", "organelle", "chloroplast"];
  const hasBioTerm = bioTerms.some((t) => q.includes(t));
  if (hasBioTerm) {
    return {
      answer: `Based on the captured pages, ${DEMO_PAGES[0].text.slice(0, 150)}... [page 1]`,
      citations: [{ page: 1 }],
      not_in_book: false,
      pages_used: [1, 2, 3],
    };
  }
  return {
    answer: "This isn't covered in the captured pages.",
    citations: [],
    not_in_book: true,
    pages_used: [1, 2, 3],
  };
}
