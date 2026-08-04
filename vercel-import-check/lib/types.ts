export type RecordStatus = "exact_duplicate" | "possible_duplicate" | "new" | "invalid";

export type ExcelRow = {
  row: number;
  name?: string;
  name_ar?: string;
  passport?: string;
  phone?: string;
  id_number?: string;
  raw: Record<string, string>;
};

export type CompareResult = {
  row: number;
  name: string;
  passport: string;
  phone: string;
  id_number: string;
  status: RecordStatus;
  matched_by: string;
  existing_record: string;
  existing_id?: string;
  existing_url?: string;
};

export type CompareSummary = {
  total: number;
  exact_duplicates: number;
  possible_duplicates: number;
  new_records: number;
  invalid_records: number;
};

export type CompareResponse = {
  ok: boolean;
  demo?: boolean;
  error?: string;
  summary: CompareSummary;
  results: CompareResult[];
  system_records_loaded: number;
};

export type ImportResponse = {
  ok: boolean;
  imported: number;
  failed: number;
  errors: { row: number; message: string }[];
};
