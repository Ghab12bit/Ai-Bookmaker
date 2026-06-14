export interface Profile {
  id: string;
  name: string;
  role: "designer" | "am";
  created_at: string;
}

export interface Review {
  id: string;
  title: string;
  client_name: string;
  stage: "internal" | "client";
  status: "in_review" | "changes_requested" | "approved";
  client_token: string;
  client_link_active: boolean;
  feedback_deadline: string | null;
  created_by: string;
  created_at: string;
}

export interface Version {
  id: string;
  review_id: string;
  version_number: number;
  file_url: string;
  file_type: "image" | "pdf";
  created_at: string;
}

export interface Pin {
  id: string;
  version_id: string;
  x_pct: number;
  y_pct: number;
  author_type: "designer" | "am" | "client";
  author_name: string;
  resolved: boolean;
  created_at: string;
  comments?: Comment[];
}

export interface Comment {
  id: string;
  pin_id: string;
  author_type: "designer" | "am" | "client";
  author_name: string;
  body: string;
  reference_url: string | null;
  created_at: string;
}

export interface FeedbackRound {
  id: string;
  review_id: string;
  submitted_by_type: "team" | "client";
  submitted_at: string;
}

export interface ReviewWithVersion extends Review {
  versions: Version[];
}
