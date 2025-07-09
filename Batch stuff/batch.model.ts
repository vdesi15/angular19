// Batch SSE Response Models
export interface BatchSSEData {
  api_txnid: string;
  time: string;
  e_name: string;
  agg: BatchAggregation[];
  summary: BatchSummary[];
  api_name: string;
  v_line: string;
  min: string;
  txn_status: boolean;
  all_rules_passed: boolean;
  good_u: number;
  good_m: number;
  dl_enable: boolean;
  rules: BatchRule[];
}

export interface BatchAggregation {
  time: string;
  type: 'U' | 'M';
  agg_total_d: number;
  agg_total_g: string | number;
  agg_total_ud: string | number;
  agg_total_rj: string | number;
  agg_ld: string;
}

export interface BatchSummary {
  type: 'U' | 'M';
  time: string;
  id: string;
  sid: string;
  front_id: string;
  total_d: string;
  usummary: string;
  dsummary: string;
  gd: string;
  status: string;
  blist: Record<string, number>;
}

export interface BatchRule {
  name: string;
  pass: boolean;
  message: string;
  data?: BatchRuleData[];
}

export interface BatchRuleData {
  id: string;
  blist: Record<string, number>;
}