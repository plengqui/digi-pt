export type GroupId =
  | 'vader'
  | 'lar'
  | 'rumpa'
  | 'rygg'
  | 'mage'
  | 'skuldror'
  | 'axlar'
  | 'biceps'
  | 'triceps'
  | 'brost'
  | 'kardio';

export type Frequency = 'ofta' | 'ibland' | 'sallan';
export type ExerciseType = 'styrka' | 'kardio';
export type SessionShape = 'fokus' | 'helkropp';
export type EntrySource = 'suggested' | 'manual';

/** Local calendar date as YYYY-MM-DD. */
export type DateString = string;

export interface Exercise {
  id: string;
  name: string;
  nameEn?: string;
  type: ExerciseType;
  primary: GroupId[];
  secondary: GroupId[];
  description?: string;
  catalogId?: string;
  archived: boolean;
}

export interface SessionEntry {
  exerciseId: string;
  done: boolean;
  source: EntrySource;
}

export interface Session {
  date: DateString;
  entries: SessionEntry[];
  /** ISO timestamp of the last change, used for the backup nudge. */
  updatedAt: string;
}

export interface Settings {
  id: 'settings';
  frequency: Record<GroupId, Frequency>;
  restDays: Record<GroupId, number>;
  exercisesPerSession: number;
  groupsPerSession: number;
  shape: SessionShape;
  firstUseDate: DateString;
  lastExportAt?: string;
  onboardingDone: boolean;
  storagePersisted?: boolean;
  schemaVersion: number;
}

export interface CapturedError {
  id?: number;
  at: string;
  message: string;
  stack?: string;
}

/** Catalog entry as shipped with the app (already mapped to her groups). */
export interface CatalogEntry {
  id: string;
  name: string;
  nameEn: string;
  aliases: string[];
  type: ExerciseType;
  primary: GroupId[];
  secondary: GroupId[];
  equipment: string;
  common: 1 | 2 | 3;
  description: string;
}
