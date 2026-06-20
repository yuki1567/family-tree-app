export const APP_NAME = 'FamilyTree'

export type Gender = 'male' | 'female' | 'other' | 'unknown'

/** 人物（要件 4.2：全項目任意） */
export interface Person {
  id: string
  name: string
  gender?: Gender
  /** 生年月日（YYYY-MM-DD、不明なら未設定） */
  birthDate?: string
  birthPlace?: string
  /** 没年月日（YYYY-MM-DD、不明なら未設定） */
  deathDate?: string
  note?: string
}
