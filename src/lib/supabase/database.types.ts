/* Generated compatibility note: this repo currently relies on permissive JSONB typing
   across many generated table and RPC shapes, so keep Json broad until the call sites
   are narrowed coherently. */
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Json = any;

export type Vector = number[] | string;

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      api_rate_limits: {
        Row: {
          bucket: string;
          owner_id: string;
          request_count: number;
          updated_at: string;
          window_start: string;
        };
        Insert: {
          bucket: string;
          owner_id: string;
          request_count?: number;
          updated_at?: string;
          window_start?: string;
        };
        Update: {
          bucket?: string;
          owner_id?: string;
          request_count?: number;
          updated_at?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          created_at: string;
          id: string;
          metadata: Json;
          owner_id: string | null;
          resource_id: string | null;
          resource_type: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          owner_id?: string | null;
          resource_id?: string | null;
          resource_type?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          owner_id?: string | null;
          resource_id?: string | null;
          resource_type?: string | null;
        };
        Relationships: [];
      };
      clinical_registry_record_sources: {
        Row: {
          created_at: string;
          document_id: string;
          id: string;
          note: string | null;
          owner_id: string;
          record_id: string;
        };
        Insert: {
          created_at?: string;
          document_id: string;
          id?: string;
          note?: string | null;
          owner_id: string;
          record_id: string;
        };
        Update: {
          created_at?: string;
          document_id?: string;
          id?: string;
          note?: string | null;
          owner_id?: string;
          record_id?: string;
        };
        Relationships: [];
      };
      clinical_registry_records: {
        Row: {
          best_use: string | null;
          catalog_payload: Json;
          catalogue_label: string | null;
          catchments: string[];
          contacts: Json;
          cost: string | null;
          created_at: string;
          criteria: Json;
          eligibility: string | null;
          id: string;
          kind: string;
          last_reviewed_at: string | null;
          location: string | null;
          navigator_query: string | null;
          owner_id: string;
          primary_contact: Json | null;
          referral: string | null;
          referral_info: Json;
          review_due_at: string | null;
          route: string | null;
          slug: string;
          source: Json;
          source_status: string;
          status_chips: Json;
          subtitle: string | null;
          summary_cards: Json;
          tags: string[];
          title: string;
          updated_at: string;
          validation_status: string;
          verification: Json;
        };
        Insert: {
          best_use?: string | null;
          catalog_payload?: Json;
          catalogue_label?: string | null;
          catchments?: string[];
          contacts?: Json;
          cost?: string | null;
          created_at?: string;
          criteria?: Json;
          eligibility?: string | null;
          id?: string;
          kind: string;
          last_reviewed_at?: string | null;
          location?: string | null;
          navigator_query?: string | null;
          owner_id: string;
          primary_contact?: Json | null;
          referral?: string | null;
          referral_info?: Json;
          review_due_at?: string | null;
          route?: string | null;
          slug: string;
          source?: Json;
          source_status?: string;
          status_chips?: Json;
          subtitle?: string | null;
          summary_cards?: Json;
          tags?: string[];
          title: string;
          updated_at?: string;
          validation_status?: string;
          verification?: Json;
        };
        Update: {
          best_use?: string | null;
          catalog_payload?: Json;
          catalogue_label?: string | null;
          catchments?: string[];
          contacts?: Json;
          cost?: string | null;
          created_at?: string;
          criteria?: Json;
          eligibility?: string | null;
          id?: string;
          kind?: string;
          last_reviewed_at?: string | null;
          location?: string | null;
          navigator_query?: string | null;
          owner_id?: string;
          primary_contact?: Json | null;
          referral?: string | null;
          referral_info?: Json;
          review_due_at?: string | null;
          route?: string | null;
          slug?: string;
          source?: Json;
          source_status?: string;
          status_chips?: Json;
          subtitle?: string | null;
          summary_cards?: Json;
          tags?: string[];
          title?: string;
          updated_at?: string;
          validation_status?: string;
          verification?: Json;
        };
        Relationships: [];
      };
      differential_records: {
        Row: {
          clinical_hinge: string | null;
          created_at: string;
          id: string;
          kind: string;
          last_reviewed_at: string | null;
          owner_id: string;
          payload: Json;
          review_due_at: string | null;
          slug: string;
          source: Json;
          source_status: string;
          status: string;
          subtitle: string | null;
          tags: string[];
          title: string;
          updated_at: string;
          validation_status: string;
        };
        Insert: {
          clinical_hinge?: string | null;
          created_at?: string;
          id?: string;
          kind: string;
          last_reviewed_at?: string | null;
          owner_id: string;
          payload?: Json;
          review_due_at?: string | null;
          slug: string;
          source?: Json;
          source_status?: string;
          status: string;
          subtitle?: string | null;
          tags?: string[];
          title: string;
          updated_at?: string;
          validation_status?: string;
        };
        Update: {
          clinical_hinge?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          last_reviewed_at?: string | null;
          owner_id?: string;
          payload?: Json;
          review_due_at?: string | null;
          slug?: string;
          source?: Json;
          source_status?: string;
          status?: string;
          subtitle?: string | null;
          tags?: string[];
          title?: string;
          updated_at?: string;
          validation_status?: string;
        };
        Relationships: [];
      };
      document_chunks: {
        Row: {
          anchor_id: string | null;
          chunk_index: number;
          content: string;
          content_hash: string | null;
          created_at: string;
          document_id: string;
          embedding: Vector;
          heading_level: number | null;
          id: string;
          image_ids: string[];
          index_generation_id: string | null;
          metadata: Json;
          page_number: number | null;
          parent_heading: string | null;
          retrieval_synopsis: string | null;
          search_tsv: unknown;
          section_heading: string | null;
          section_path: string[];
          token_estimate: number;
        };
        Insert: {
          anchor_id?: string | null;
          chunk_index: number;
          content: string;
          content_hash?: string | null;
          created_at?: string;
          document_id: string;
          embedding: Vector;
          heading_level?: number | null;
          id?: string;
          image_ids?: string[];
          index_generation_id?: string | null;
          metadata?: Json;
          page_number?: number | null;
          parent_heading?: string | null;
          retrieval_synopsis?: string | null;
          search_tsv?: unknown;
          section_heading?: string | null;
          section_path?: string[];
          token_estimate?: number;
        };
        Update: {
          anchor_id?: string | null;
          chunk_index?: number;
          content?: string;
          content_hash?: string | null;
          created_at?: string;
          document_id?: string;
          embedding?: Vector;
          heading_level?: number | null;
          id?: string;
          image_ids?: string[];
          index_generation_id?: string | null;
          metadata?: Json;
          page_number?: number | null;
          parent_heading?: string | null;
          retrieval_synopsis?: string | null;
          search_tsv?: unknown;
          section_heading?: string | null;
          section_path?: string[];
          token_estimate?: number;
        };
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "document_strict_gate_status";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "document_chunks_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      document_embedding_fields: {
        Row: {
          content: string;
          content_hash: string;
          created_at: string;
          document_id: string;
          embedding: Vector;
          field_type: string;
          id: string;
          metadata: Json;
          owner_id: string | null;
          search_tsv: unknown;
          source_chunk_id: string | null;
        };
        Insert: {
          content: string;
          content_hash: string;
          created_at?: string;
          document_id: string;
          embedding: Vector;
          field_type: string;
          id?: string;
          metadata?: Json;
          owner_id?: string | null;
          search_tsv?: unknown;
          source_chunk_id?: string | null;
        };
        Update: {
          content?: string;
          content_hash?: string;
          created_at?: string;
          document_id?: string;
          embedding?: Vector;
          field_type?: string;
          id?: string;
          metadata?: Json;
          owner_id?: string | null;
          search_tsv?: unknown;
          source_chunk_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "document_embedding_fields_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "document_strict_gate_status";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "document_embedding_fields_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_embedding_fields_source_chunk_id_fkey";
            columns: ["source_chunk_id"];
            isOneToOne: false;
            referencedRelation: "document_chunks";
            referencedColumns: ["id"];
          },
        ];
      };
      document_images: {
        Row: {
          bbox: Json | null;
          caption: string;
          caption_confidence: number | null;
          clinical_priority_score: number | null;
          clinical_relevance_score: number;
          created_at: string;
          crop_completeness: number | null;
          document_id: string;
          height: number | null;
          id: string;
          image_hash: string | null;
          image_quality_score: number | null;
          image_type: string;
          labels: string[];
          metadata: Json;
          mime_type: string;
          ocr_text_density: number | null;
          page_number: number | null;
          perceptual_hash: string | null;
          searchable: boolean;
          skip_reason: string | null;
          source_kind: string;
          storage_path: string;
          structured_extraction_confidence: number | null;
          visual_duplicate_group: string | null;
          width: number | null;
        };
        Insert: {
          bbox?: Json | null;
          caption?: string;
          caption_confidence?: number | null;
          clinical_priority_score?: number | null;
          clinical_relevance_score?: number;
          created_at?: string;
          crop_completeness?: number | null;
          document_id: string;
          height?: number | null;
          id?: string;
          image_hash?: string | null;
          image_quality_score?: number | null;
          image_type?: string;
          labels?: string[];
          metadata?: Json;
          mime_type?: string;
          ocr_text_density?: number | null;
          page_number?: number | null;
          perceptual_hash?: string | null;
          searchable?: boolean;
          skip_reason?: string | null;
          source_kind?: string;
          storage_path: string;
          structured_extraction_confidence?: number | null;
          visual_duplicate_group?: string | null;
          width?: number | null;
        };
        Update: {
          bbox?: Json | null;
          caption?: string;
          caption_confidence?: number | null;
          clinical_priority_score?: number | null;
          clinical_relevance_score?: number;
          created_at?: string;
          crop_completeness?: number | null;
          document_id?: string;
          height?: number | null;
          id?: string;
          image_hash?: string | null;
          image_quality_score?: number | null;
          image_type?: string;
          labels?: string[];
          metadata?: Json;
          mime_type?: string;
          ocr_text_density?: number | null;
          page_number?: number | null;
          perceptual_hash?: string | null;
          searchable?: boolean;
          skip_reason?: string | null;
          source_kind?: string;
          storage_path?: string;
          structured_extraction_confidence?: number | null;
          visual_duplicate_group?: string | null;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "document_images_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "document_strict_gate_status";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "document_images_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      document_index_quality: {
        Row: {
          anchor_coverage: number | null;
          document_id: string;
          extraction_quality: string;
          issues: string[];
          metrics: Json;
          model_fallback_rate: number | null;
          noisy_unit_rate: number | null;
          owner_id: string | null;
          quality_score: number;
          retrievable_visual_hit: boolean | null;
          source_span_coverage: number | null;
          typed_unit_coverage: number | null;
          updated_at: string;
        };
        Insert: {
          anchor_coverage?: number | null;
          document_id: string;
          extraction_quality?: string;
          issues?: string[];
          metrics?: Json;
          model_fallback_rate?: number | null;
          noisy_unit_rate?: number | null;
          owner_id?: string | null;
          quality_score?: number;
          retrievable_visual_hit?: boolean | null;
          source_span_coverage?: number | null;
          typed_unit_coverage?: number | null;
          updated_at?: string;
        };
        Update: {
          anchor_coverage?: number | null;
          document_id?: string;
          extraction_quality?: string;
          issues?: string[];
          metrics?: Json;
          model_fallback_rate?: number | null;
          noisy_unit_rate?: number | null;
          owner_id?: string | null;
          quality_score?: number;
          retrievable_visual_hit?: boolean | null;
          source_span_coverage?: number | null;
          typed_unit_coverage?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_index_quality_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: true;
            referencedRelation: "document_strict_gate_status";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "document_index_quality_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: true;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      document_index_units: {
        Row: {
          content: string;
          created_at: string;
          document_id: string;
          embedding: Vector;
          extraction_mode: string;
          heading_path: string[];
          id: string;
          metadata: Json;
          normalized_terms: string[];
          owner_id: string | null;
          page_end: number | null;
          page_start: number | null;
          quality_score: number;
          search_tsv: unknown;
          source_chunk_id: string | null;
          source_image_id: string | null;
          source_span: Json | null;
          title: string;
          unit_type: string;
          updated_at: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          document_id: string;
          embedding: Vector;
          extraction_mode?: string;
          heading_path?: string[];
          id?: string;
          metadata?: Json;
          normalized_terms?: string[];
          owner_id?: string | null;
          page_end?: number | null;
          page_start?: number | null;
          quality_score?: number;
          search_tsv?: unknown;
          source_chunk_id?: string | null;
          source_image_id?: string | null;
          source_span?: Json | null;
          title: string;
          unit_type: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          document_id?: string;
          embedding?: Vector;
          extraction_mode?: string;
          heading_path?: string[];
          id?: string;
          metadata?: Json;
          normalized_terms?: string[];
          owner_id?: string | null;
          page_end?: number | null;
          page_start?: number | null;
          quality_score?: number;
          search_tsv?: unknown;
          source_chunk_id?: string | null;
          source_image_id?: string | null;
          source_span?: Json | null;
          title?: string;
          unit_type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_index_units_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "document_strict_gate_status";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "document_index_units_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_index_units_source_chunk_id_fkey";
            columns: ["source_chunk_id"];
            isOneToOne: false;
            referencedRelation: "document_chunks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_index_units_source_image_id_fkey";
            columns: ["source_image_id"];
            isOneToOne: false;
            referencedRelation: "document_images";
            referencedColumns: ["id"];
          },
        ];
      };
      document_labels: {
        Row: {
          confidence: number;
          created_at: string;
          document_id: string;
          id: string;
          label: string;
          label_type: string;
          metadata: Json;
          owner_id: string | null;
          source: string;
          updated_at: string;
        };
        Insert: {
          confidence?: number;
          created_at?: string;
          document_id: string;
          id?: string;
          label: string;
          label_type: string;
          metadata?: Json;
          owner_id?: string | null;
          source?: string;
          updated_at?: string;
        };
        Update: {
          confidence?: number;
          created_at?: string;
          document_id?: string;
          id?: string;
          label?: string;
          label_type?: string;
          metadata?: Json;
          owner_id?: string | null;
          source?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_labels_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "document_strict_gate_status";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "document_labels_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      document_memory_cards: {
        Row: {
          card_type: string;
          confidence: number;
          content: string;
          created_at: string;
          document_id: string;
          embedding: Vector;
          id: string;
          metadata: Json;
          normalized_terms: string[];
          owner_id: string | null;
          page_number: number | null;
          search_tsv: unknown;
          section_id: string | null;
          source_chunk_ids: string[];
          source_image_ids: string[];
          title: string;
          updated_at: string;
        };
        Insert: {
          card_type: string;
          confidence?: number;
          content: string;
          created_at?: string;
          document_id: string;
          embedding: Vector;
          id?: string;
          metadata?: Json;
          normalized_terms?: string[];
          owner_id?: string | null;
          page_number?: number | null;
          search_tsv?: unknown;
          section_id?: string | null;
          source_chunk_ids?: string[];
          source_image_ids?: string[];
          title: string;
          updated_at?: string;
        };
        Update: {
          card_type?: string;
          confidence?: number;
          content?: string;
          created_at?: string;
          document_id?: string;
          embedding?: Vector;
          id?: string;
          metadata?: Json;
          normalized_terms?: string[];
          owner_id?: string | null;
          page_number?: number | null;
          search_tsv?: unknown;
          section_id?: string | null;
          source_chunk_ids?: string[];
          source_image_ids?: string[];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_memory_cards_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "document_strict_gate_status";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "document_memory_cards_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_memory_cards_section_id_fkey";
            columns: ["section_id"];
            isOneToOne: false;
            referencedRelation: "document_sections";
            referencedColumns: ["id"];
          },
        ];
      };
      document_pages: {
        Row: {
          created_at: string;
          document_id: string;
          id: string;
          metadata: Json;
          ocr_used: boolean;
          page_number: number;
          text: string;
        };
        Insert: {
          created_at?: string;
          document_id: string;
          id?: string;
          metadata?: Json;
          ocr_used?: boolean;
          page_number: number;
          text?: string;
        };
        Update: {
          created_at?: string;
          document_id?: string;
          id?: string;
          metadata?: Json;
          ocr_used?: boolean;
          page_number?: number;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_pages_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "document_strict_gate_status";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "document_pages_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      document_sections: {
        Row: {
          chunk_ids: string[];
          created_at: string;
          document_id: string;
          extraction_quality: string;
          heading: string;
          heading_path: string[];
          id: string;
          metadata: Json;
          owner_id: string | null;
          page_end: number | null;
          page_start: number | null;
          section_index: number;
          summary: string;
          tags: string[];
          updated_at: string;
        };
        Insert: {
          chunk_ids?: string[];
          created_at?: string;
          document_id: string;
          extraction_quality?: string;
          heading: string;
          heading_path?: string[];
          id?: string;
          metadata?: Json;
          owner_id?: string | null;
          page_end?: number | null;
          page_start?: number | null;
          section_index: number;
          summary?: string;
          tags?: string[];
          updated_at?: string;
        };
        Update: {
          chunk_ids?: string[];
          created_at?: string;
          document_id?: string;
          extraction_quality?: string;
          heading?: string;
          heading_path?: string[];
          id?: string;
          metadata?: Json;
          owner_id?: string | null;
          page_end?: number | null;
          page_start?: number | null;
          section_index?: number;
          summary?: string;
          tags?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_sections_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "document_strict_gate_status";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "document_sections_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      document_summaries: {
        Row: {
          clinical_specifics: Json;
          created_at: string;
          document_id: string;
          generated_at: string;
          id: string;
          metadata: Json;
          model: string | null;
          owner_id: string | null;
          source_chunk_ids: string[];
          source_image_ids: string[];
          summary: string;
          updated_at: string;
        };
        Insert: {
          clinical_specifics?: Json;
          created_at?: string;
          document_id: string;
          generated_at?: string;
          id?: string;
          metadata?: Json;
          model?: string | null;
          owner_id?: string | null;
          source_chunk_ids?: string[];
          source_image_ids?: string[];
          summary: string;
          updated_at?: string;
        };
        Update: {
          clinical_specifics?: Json;
          created_at?: string;
          document_id?: string;
          generated_at?: string;
          id?: string;
          metadata?: Json;
          model?: string | null;
          owner_id?: string | null;
          source_chunk_ids?: string[];
          source_image_ids?: string[];
          summary?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_summaries_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: true;
            referencedRelation: "document_strict_gate_status";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "document_summaries_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: true;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      document_table_facts: {
        Row: {
          action: string | null;
          clinical_parameter: string | null;
          created_at: string;
          document_id: string;
          id: string;
          metadata: Json;
          normalized_terms: string[];
          owner_id: string | null;
          page_number: number | null;
          row_label: string | null;
          search_tsv: unknown;
          source_chunk_id: string | null;
          source_image_id: string | null;
          table_title: string | null;
          threshold_value: string | null;
        };
        Insert: {
          action?: string | null;
          clinical_parameter?: string | null;
          created_at?: string;
          document_id: string;
          id?: string;
          metadata?: Json;
          normalized_terms?: string[];
          owner_id?: string | null;
          page_number?: number | null;
          row_label?: string | null;
          search_tsv?: unknown;
          source_chunk_id?: string | null;
          source_image_id?: string | null;
          table_title?: string | null;
          threshold_value?: string | null;
        };
        Update: {
          action?: string | null;
          clinical_parameter?: string | null;
          created_at?: string;
          document_id?: string;
          id?: string;
          metadata?: Json;
          normalized_terms?: string[];
          owner_id?: string | null;
          page_number?: number | null;
          row_label?: string | null;
          search_tsv?: unknown;
          source_chunk_id?: string | null;
          source_image_id?: string | null;
          table_title?: string | null;
          threshold_value?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "document_table_facts_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "document_strict_gate_status";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "document_table_facts_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_table_facts_source_chunk_id_fkey";
            columns: ["source_chunk_id"];
            isOneToOne: false;
            referencedRelation: "document_chunks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_table_facts_source_image_id_fkey";
            columns: ["source_image_id"];
            isOneToOne: false;
            referencedRelation: "document_images";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          chunk_count: number;
          content_hash: string | null;
          created_at: string;
          description: string | null;
          error_message: string | null;
          file_name: string;
          file_size: number;
          file_type: string;
          id: string;
          image_count: number;
          import_batch_id: string | null;
          metadata: Json;
          owner_id: string | null;
          page_count: number;
          search_tsv: unknown;
          source_path: string | null;
          status: string;
          storage_path: string;
          title: string;
          title_search_tsv: unknown;
          updated_at: string;
        };
        Insert: {
          chunk_count?: number;
          content_hash?: string | null;
          created_at?: string;
          description?: string | null;
          error_message?: string | null;
          file_name: string;
          file_size?: number;
          file_type: string;
          id?: string;
          image_count?: number;
          import_batch_id?: string | null;
          metadata?: Json;
          owner_id?: string | null;
          page_count?: number;
          search_tsv?: unknown;
          source_path?: string | null;
          status?: string;
          storage_path: string;
          title: string;
          title_search_tsv?: unknown;
          updated_at?: string;
        };
        Update: {
          chunk_count?: number;
          content_hash?: string | null;
          created_at?: string;
          description?: string | null;
          error_message?: string | null;
          file_name?: string;
          file_size?: number;
          file_type?: string;
          id?: string;
          image_count?: number;
          import_batch_id?: string | null;
          metadata?: Json;
          owner_id?: string | null;
          page_count?: number;
          search_tsv?: unknown;
          source_path?: string | null;
          status?: string;
          storage_path?: string;
          title?: string;
          title_search_tsv?: unknown;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_import_batch_id_fkey";
            columns: ["import_batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id"];
          },
        ];
      };
      image_caption_cache: {
        Row: {
          caption: string;
          created_at: string;
          id: string;
          image_hash: string;
          metadata: Json;
          mime_type: string | null;
          model: string;
          owner_id: string;
          updated_at: string;
        };
        Insert: {
          caption: string;
          created_at?: string;
          id?: string;
          image_hash: string;
          metadata?: Json;
          mime_type?: string | null;
          model: string;
          owner_id: string;
          updated_at?: string;
        };
        Update: {
          caption?: string;
          created_at?: string;
          id?: string;
          image_hash?: string;
          metadata?: Json;
          mime_type?: string | null;
          model?: string;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      import_batches: {
        Row: {
          completed_at: string | null;
          created_at: string;
          failed_files: number;
          id: string;
          include_glob: string;
          metadata: Json;
          name: string;
          owner_id: string | null;
          queued_files: number;
          skipped_files: number;
          source_root: string | null;
          status: string;
          total_bytes: number;
          total_files: number;
          updated_at: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          failed_files?: number;
          id?: string;
          include_glob?: string;
          metadata?: Json;
          name: string;
          owner_id?: string | null;
          queued_files?: number;
          skipped_files?: number;
          source_root?: string | null;
          status?: string;
          total_bytes?: number;
          total_files?: number;
          updated_at?: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          failed_files?: number;
          id?: string;
          include_glob?: string;
          metadata?: Json;
          name?: string;
          owner_id?: string | null;
          queued_files?: number;
          skipped_files?: number;
          source_root?: string | null;
          status?: string;
          total_bytes?: number;
          total_files?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      ingestion_job_stages: {
        Row: {
          artifact_counts: Json;
          created_at: string;
          document_id: string;
          error_class: string | null;
          error_message: string | null;
          finished_at: string | null;
          id: string;
          job_id: string;
          metadata: Json;
          retry_count: number;
          stage_name: string;
          stage_status: string;
          started_at: string;
        };
        Insert: {
          artifact_counts?: Json;
          created_at?: string;
          document_id: string;
          error_class?: string | null;
          error_message?: string | null;
          finished_at?: string | null;
          id?: string;
          job_id: string;
          metadata?: Json;
          retry_count?: number;
          stage_name: string;
          stage_status?: string;
          started_at?: string;
        };
        Update: {
          artifact_counts?: Json;
          created_at?: string;
          document_id?: string;
          error_class?: string | null;
          error_message?: string | null;
          finished_at?: string | null;
          id?: string;
          job_id?: string;
          metadata?: Json;
          retry_count?: number;
          stage_name?: string;
          stage_status?: string;
          started_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingestion_job_stages_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "document_strict_gate_status";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "ingestion_job_stages_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      ingestion_jobs: {
        Row: {
          attempt_count: number;
          batch_id: string | null;
          completed_at: string | null;
          created_at: string;
          document_id: string;
          error_message: string | null;
          id: string;
          locked_at: string | null;
          locked_by: string | null;
          max_attempts: number;
          next_run_at: string;
          progress: number;
          stage: string;
          started_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempt_count?: number;
          batch_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          document_id: string;
          error_message?: string | null;
          id?: string;
          locked_at?: string | null;
          locked_by?: string | null;
          max_attempts?: number;
          next_run_at?: string;
          progress?: number;
          stage?: string;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempt_count?: number;
          batch_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          document_id?: string;
          error_message?: string | null;
          id?: string;
          locked_at?: string | null;
          locked_by?: string | null;
          max_attempts?: number;
          next_run_at?: string;
          progress?: number;
          stage?: string;
          started_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingestion_jobs_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ingestion_jobs_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "document_strict_gate_status";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "ingestion_jobs_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      medication_records: {
        Row: {
          accent: string | null;
          category: string | null;
          class: string | null;
          created_at: string;
          id: string;
          last_reviewed_at: string | null;
          name: string;
          owner_id: string;
          quick: Json;
          review_due_at: string | null;
          schedule: string | null;
          sections: Json;
          slug: string;
          source_status: string;
          stats: Json;
          subclass: string | null;
          tag: string | null;
          updated_at: string;
          validation_status: string;
        };
        Insert: {
          accent?: string | null;
          category?: string | null;
          class?: string | null;
          created_at?: string;
          id?: string;
          last_reviewed_at?: string | null;
          name: string;
          owner_id: string;
          quick?: Json;
          review_due_at?: string | null;
          schedule?: string | null;
          sections?: Json;
          slug: string;
          source_status?: string;
          stats?: Json;
          subclass?: string | null;
          tag?: string | null;
          updated_at?: string;
          validation_status?: string;
        };
        Update: {
          accent?: string | null;
          category?: string | null;
          class?: string | null;
          created_at?: string;
          id?: string;
          last_reviewed_at?: string | null;
          name?: string;
          owner_id?: string;
          quick?: Json;
          review_due_at?: string | null;
          schedule?: string | null;
          sections?: Json;
          slug?: string;
          source_status?: string;
          stats?: Json;
          subclass?: string | null;
          tag?: string | null;
          updated_at?: string;
          validation_status?: string;
        };
        Relationships: [];
      };
      rag_aliases: {
        Row: {
          alias: string;
          alias_type: string;
          canonical: string;
          created_at: string;
          enabled: boolean;
          id: string;
          metadata: Json;
          owner_id: string | null;
          updated_at: string;
          weight: number;
        };
        Insert: {
          alias: string;
          alias_type: string;
          canonical: string;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          metadata?: Json;
          owner_id?: string | null;
          updated_at?: string;
          weight?: number;
        };
        Update: {
          alias?: string;
          alias_type?: string;
          canonical?: string;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          metadata?: Json;
          owner_id?: string | null;
          updated_at?: string;
          weight?: number;
        };
        Relationships: [];
      };
      rag_queries: {
        Row: {
          answer: string | null;
          created_at: string;
          id: string;
          metadata: Json;
          model: string | null;
          owner_id: string | null;
          query: string;
          source_chunk_ids: string[];
        };
        Insert: {
          answer?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          model?: string | null;
          owner_id?: string | null;
          query: string;
          source_chunk_ids?: string[];
        };
        Update: {
          answer?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          model?: string | null;
          owner_id?: string | null;
          query?: string;
          source_chunk_ids?: string[];
        };
        Relationships: [];
      };
      rag_query_misses: {
        Row: {
          candidate_aliases: string[];
          candidate_labels: Json;
          cited_chunk_ids: string[];
          clicked_chunk_id: string | null;
          clicked_document_id: string | null;
          created_at: string;
          expected_chunk_id: string | null;
          expected_document_id: string | null;
          expected_file: string | null;
          id: string;
          metadata: Json;
          miss_reason: string;
          normalized_query: string;
          owner_id: string | null;
          promoted_at: string | null;
          promoted_eval_case: boolean;
          query: string;
          query_class: string | null;
          retrieval_strategy: string | null;
          review_notes: string | null;
          review_status: string;
          reviewed_at: string | null;
          route: string | null;
          top_chunk_ids: string[];
          top_files: string[];
          top_score: number | null;
        };
        Insert: {
          candidate_aliases?: string[];
          candidate_labels?: Json;
          cited_chunk_ids?: string[];
          clicked_chunk_id?: string | null;
          clicked_document_id?: string | null;
          created_at?: string;
          expected_chunk_id?: string | null;
          expected_document_id?: string | null;
          expected_file?: string | null;
          id?: string;
          metadata?: Json;
          miss_reason?: string;
          normalized_query: string;
          owner_id?: string | null;
          promoted_at?: string | null;
          promoted_eval_case?: boolean;
          query: string;
          query_class?: string | null;
          retrieval_strategy?: string | null;
          review_notes?: string | null;
          review_status?: string;
          reviewed_at?: string | null;
          route?: string | null;
          top_chunk_ids?: string[];
          top_files?: string[];
          top_score?: number | null;
        };
        Update: {
          candidate_aliases?: string[];
          candidate_labels?: Json;
          cited_chunk_ids?: string[];
          clicked_chunk_id?: string | null;
          clicked_document_id?: string | null;
          created_at?: string;
          expected_chunk_id?: string | null;
          expected_document_id?: string | null;
          expected_file?: string | null;
          id?: string;
          metadata?: Json;
          miss_reason?: string;
          normalized_query?: string;
          owner_id?: string | null;
          promoted_at?: string | null;
          promoted_eval_case?: boolean;
          query?: string;
          query_class?: string | null;
          retrieval_strategy?: string | null;
          review_notes?: string | null;
          review_status?: string;
          reviewed_at?: string | null;
          route?: string | null;
          top_chunk_ids?: string[];
          top_files?: string[];
          top_score?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "rag_query_misses_expected_chunk_id_fkey";
            columns: ["expected_chunk_id"];
            isOneToOne: false;
            referencedRelation: "document_chunks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rag_query_misses_expected_document_id_fkey";
            columns: ["expected_document_id"];
            isOneToOne: false;
            referencedRelation: "document_strict_gate_status";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "rag_query_misses_expected_document_id_fkey";
            columns: ["expected_document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      rag_response_cache: {
        Row: {
          cache_kind: string;
          created_at: string;
          dependency_version: string;
          expires_at: string;
          id: string;
          indexing_version: string;
          normalized_query: string;
          owner_id: string | null;
          payload: Json;
          scope_key: string;
          updated_at: string;
        };
        Insert: {
          cache_kind: string;
          created_at?: string;
          dependency_version?: string;
          expires_at: string;
          id?: string;
          indexing_version?: string;
          normalized_query: string;
          owner_id?: string | null;
          payload: Json;
          scope_key: string;
          updated_at?: string;
        };
        Update: {
          cache_kind?: string;
          created_at?: string;
          dependency_version?: string;
          expires_at?: string;
          id?: string;
          indexing_version?: string;
          normalized_query?: string;
          owner_id?: string | null;
          payload?: Json;
          scope_key?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rag_retrieval_logs: {
        Row: {
          candidate_count: number;
          created_at: string;
          embedding_cache_hit: boolean | null;
          embedding_field_count: number | null;
          embedding_latency_ms: number | null;
          id: string;
          index_unit_count: number | null;
          is_miss: boolean;
          mean_hybrid_score: number | null;
          memory_card_count: number | null;
          metadata: Json;
          miss_reason: string | null;
          normalized_query: string | null;
          owner_id: string | null;
          query: string;
          query_class: string | null;
          rerank_latency_ms: number | null;
          retrieval_strategy: string | null;
          rpc_latency_ms: number | null;
          selected_chunk_ids: string[];
          selected_count: number;
          selected_document_ids: string[];
          text_candidate_count: number | null;
          top_hybrid_score: number | null;
          top_rrf_score: number | null;
          top_similarity: number | null;
          top_text_rank: number | null;
          total_latency_ms: number | null;
          vector_candidate_count: number | null;
        };
        Insert: {
          candidate_count?: number;
          created_at?: string;
          embedding_cache_hit?: boolean | null;
          embedding_field_count?: number | null;
          embedding_latency_ms?: number | null;
          id?: string;
          index_unit_count?: number | null;
          is_miss?: boolean;
          mean_hybrid_score?: number | null;
          memory_card_count?: number | null;
          metadata?: Json;
          miss_reason?: string | null;
          normalized_query?: string | null;
          owner_id?: string | null;
          query: string;
          query_class?: string | null;
          rerank_latency_ms?: number | null;
          retrieval_strategy?: string | null;
          rpc_latency_ms?: number | null;
          selected_chunk_ids?: string[];
          selected_count?: number;
          selected_document_ids?: string[];
          text_candidate_count?: number | null;
          top_hybrid_score?: number | null;
          top_rrf_score?: number | null;
          top_similarity?: number | null;
          top_text_rank?: number | null;
          total_latency_ms?: number | null;
          vector_candidate_count?: number | null;
        };
        Update: {
          candidate_count?: number;
          created_at?: string;
          embedding_cache_hit?: boolean | null;
          embedding_field_count?: number | null;
          embedding_latency_ms?: number | null;
          id?: string;
          index_unit_count?: number | null;
          is_miss?: boolean;
          mean_hybrid_score?: number | null;
          memory_card_count?: number | null;
          metadata?: Json;
          miss_reason?: string | null;
          normalized_query?: string | null;
          owner_id?: string | null;
          query?: string;
          query_class?: string | null;
          rerank_latency_ms?: number | null;
          retrieval_strategy?: string | null;
          rpc_latency_ms?: number | null;
          selected_chunk_ids?: string[];
          selected_count?: number;
          selected_document_ids?: string[];
          text_candidate_count?: number | null;
          top_hybrid_score?: number | null;
          top_rrf_score?: number | null;
          top_similarity?: number | null;
          top_text_rank?: number | null;
          total_latency_ms?: number | null;
          vector_candidate_count?: number | null;
        };
        Relationships: [];
      };
      rag_visual_eval_cases: {
        Row: {
          active: boolean;
          case_name: string;
          created_at: string;
          document_id: string | null;
          expected_image_type: string | null;
          expected_terms: string[];
          expected_unit_types: string[];
          id: string;
          metadata: Json;
          owner_id: string | null;
          query: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          case_name: string;
          created_at?: string;
          document_id?: string | null;
          expected_image_type?: string | null;
          expected_terms?: string[];
          expected_unit_types?: string[];
          id?: string;
          metadata?: Json;
          owner_id?: string | null;
          query: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          case_name?: string;
          created_at?: string;
          document_id?: string | null;
          expected_image_type?: string | null;
          expected_terms?: string[];
          expected_unit_types?: string[];
          id?: string;
          metadata?: Json;
          owner_id?: string | null;
          query?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rag_visual_eval_cases_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "document_strict_gate_status";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "rag_visual_eval_cases_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      rag_visual_eval_runs: {
        Row: {
          case_id: string;
          created_at: string;
          document_id: string | null;
          hit_payload: Json;
          id: string;
          matched_count: number;
          passed: boolean;
          run_metadata: Json;
          top_hit: boolean;
        };
        Insert: {
          case_id: string;
          created_at?: string;
          document_id?: string | null;
          hit_payload?: Json;
          id?: string;
          matched_count?: number;
          passed: boolean;
          run_metadata?: Json;
          top_hit: boolean;
        };
        Update: {
          case_id?: string;
          created_at?: string;
          document_id?: string | null;
          hit_payload?: Json;
          id?: string;
          matched_count?: number;
          passed?: boolean;
          run_metadata?: Json;
          top_hit?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "rag_visual_eval_runs_case_id_fkey";
            columns: ["case_id"];
            isOneToOne: false;
            referencedRelation: "rag_visual_eval_cases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rag_visual_eval_runs_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "document_strict_gate_status";
            referencedColumns: ["document_id"];
          },
          {
            foreignKeyName: "rag_visual_eval_runs_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      storage_cleanup_jobs: {
        Row: {
          attempts: number;
          completed_at: string | null;
          created_at: string;
          document_bucket: string;
          document_id: string | null;
          document_paths: string[];
          document_title: string | null;
          id: string;
          image_bucket: string;
          image_paths: string[];
          last_error: string | null;
          metadata: Json;
          owner_id: string | null;
          status: string;
          storage_removed: number;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          document_bucket?: string;
          document_id?: string | null;
          document_paths?: string[];
          document_title?: string | null;
          id?: string;
          image_bucket?: string;
          image_paths?: string[];
          last_error?: string | null;
          metadata?: Json;
          owner_id?: string | null;
          status?: string;
          storage_removed?: number;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          completed_at?: string | null;
          created_at?: string;
          document_bucket?: string;
          document_id?: string | null;
          document_paths?: string[];
          document_title?: string | null;
          id?: string;
          image_bucket?: string;
          image_paths?: string[];
          last_error?: string | null;
          metadata?: Json;
          owner_id?: string | null;
          status?: string;
          storage_removed?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      document_strict_gate_status: {
        Row: {
          counts: Json | null;
          document_id: string | null;
          document_status: string | null;
          document_updated_at: string | null;
          enrichment_status: string | null;
          gate_passed: boolean | null;
          generated_labels: number | null;
          index_units: number | null;
          indexing_v3_agent_status: string | null;
          memory_cards: number | null;
          missing: string[] | null;
          owner_id: string | null;
          presence: Json | null;
          quality_extraction_quality: string | null;
          quality_score: number | null;
          sections: number | null;
          summary_embedding: boolean | null;
          title_embedding: boolean | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      analyze_rag_tables: { Args: never; Returns: undefined };
      consume_api_subject_rate_limit: {
        Args: {
          p_subject_key: string;
          p_bucket: string;
          p_limit: number;
          p_window_seconds: number;
        };
        Returns: {
          limited: boolean;
          limit_value: number;
          remaining: number;
          retry_after_seconds: number;
          reset_at: string;
        }[];
      };
      chunk_image_metadata: {
        Args: { chunk_image_ids: string[] };
        Returns: Json;
      };
      claim_indexing_v3_agent_jobs: {
        Args: {
          p_claim_limit?: number;
          p_stale_after_minutes?: number;
          p_worker_id: string;
        };
        Returns: {
          attempt_count: number;
          batch_id: string;
          document_id: string;
          documents: Json;
          error_message: string;
          id: string;
          locked_at: string;
          locked_by: string;
          max_attempts: number;
          progress: number;
          stage: string;
          status: string;
        }[];
      };
      claim_ingestion_jobs: {
        Args: {
          p_claim_limit?: number;
          p_stale_after_minutes?: number;
          p_worker_id: string;
        };
        Returns: {
          attempt_count: number;
          batch_id: string;
          document_id: string;
          documents: Json;
          error_message: string;
          id: string;
          locked_at: string;
          locked_by: string;
          max_attempts: number;
          progress: number;
          stage: string;
          status: string;
        }[];
      };
      cleanup_abandoned_document_index_generations: {
        Args: { p_document_id?: string | null; p_dry_run?: boolean; p_limit?: number };
        Returns: Json;
      };
      apply_document_metadata_patch: {
        Args: {
          p_document_id: string;
          p_metadata_patch?: Json;
        };
        Returns: undefined;
      };
      commit_document_index_generation: {
        Args: {
          p_chunk_count?: number;
          p_document_id: string;
          p_image_count?: number;
          p_index_generation_id: string;
          p_metadata?: Json;
          p_page_count?: number;
          p_pages?: Json;
          p_quality?: Json;
          p_status?: string;
        };
        Returns: Json;
      };
      jsonb_merge_deep: {
        Args: {
          patch_obj?: Json;
          target_obj?: Json;
        };
        Returns: Json;
      };
      complete_ingestion_job: {
        Args: {
          p_batch_id?: string | null;
          p_document_id: string;
          p_job_id: string;
          p_stage?: string;
        };
        Returns: Json;
      };
      complete_strict_enrichment_job: {
        Args: {
          p_agent_version?: string;
          p_document_id: string;
          p_job_id?: string;
          p_stage?: string;
          p_visual_indexing_version?: string;
        };
        Returns: {
          completed_job_ids: string[];
          counts: Json;
          document_id: string;
          gate_passed: boolean;
          missing: string[];
          ok: boolean;
          presence: Json;
          status: string;
        }[];
      };
      consume_api_rate_limit: {
        Args: {
          p_bucket: string;
          p_limit: number;
          p_owner_id: string;
          p_window_seconds: number;
        };
        Returns: {
          limit_value: number;
          limited: boolean;
          remaining: number;
          reset_at: string;
          retry_after_seconds: number;
        }[];
      };
      corpus_topic_term_stats: {
        Args: { terms: string[]; owner_filter?: string | null };
        Returns: {
          term: string;
          has_ts_signal: boolean;
          title_doc_count: number;
          chunk_present: boolean;
          total_doc_count: number;
        }[];
      };
      correct_clinical_query_terms: {
        Args: { input_query: string; min_sim?: number };
        Returns: string;
      };
      detect_legacy_ivfflat_indexes: { Args: never; Returns: string[] };
      document_label_metadata: {
        Args: { p_document_id: string };
        Returns: Json;
      };
      document_summary_text: {
        Args: { p_document_id: string };
        Returns: string;
      };
      explain_retrieval_rpc: {
        Args: {
          p_analyze?: boolean;
          p_document_filters?: string[] | null;
          p_match_count?: number;
          p_owner_filter?: string | null;
          p_query_text: string;
          p_rpc: string;
        };
        Returns: Json;
      };
      fail_or_retry_ingestion_job: {
        Args: {
          p_batch_id?: string | null;
          p_document_id: string;
          p_document_status?: string;
          p_error_message?: string;
          p_job_id: string;
          p_next_run_at?: string | null;
          p_retry?: boolean;
          p_stage?: string;
        };
        Returns: Json;
      };
      get_related_document_metadata: {
        Args: { document_ids: string[]; owner_filter?: string | null };
        Returns: {
          document_id: string;
          labels: Json;
          summary: string;
        }[];
      };
      get_visual_evidence_cards: {
        Args: { p_document_id: string; p_limit?: number };
        Returns: {
          image_caption: string;
          image_storage_path: string;
          image_type: string;
          page_number: number;
          source_image_id: string;
          unit_content: string;
          unit_id: string;
          unit_metadata: Json;
          unit_quality_score: number;
          unit_title: string;
          unit_type: string;
        }[];
      };
      invoke_indexing_v3_agent: { Args: { p_limit?: number }; Returns: number };
      invoke_ingestion_worker: { Args: { p_limit?: number }; Returns: number };
      is_committed_artifact_generation: {
        Args: { artifact_metadata: Json; document_metadata: Json };
        Returns: boolean;
      };
      is_committed_document_generation: {
        Args: { document_metadata: Json; row_generation: string };
        Returns: boolean;
      };
      match_document_chunks: {
        Args: {
          document_filter?: string | null;
          match_count?: number;
          min_similarity?: number;
          owner_filter?: string | null;
          query_embedding: Vector;
        };
        Returns: {
          chunk_index: number;
          content: string;
          document_id: string;
          document_labels: Json;
          document_summary: string;
          file_name: string;
          id: string;
          image_ids: string[];
          images: Json;
          page_number: number;
          retrieval_synopsis: string;
          section_heading: string;
          similarity: number;
          source_metadata: Json;
          title: string;
        }[];
      };
      match_document_chunks_hybrid: {
        Args: {
          document_filters?: string[] | null;
          match_count?: number;
          min_similarity?: number;
          owner_filter?: string | null;
          query_embedding: Vector;
          query_text: string;
        };
        Returns: {
          chunk_index: number;
          content: string;
          document_id: string;
          file_name: string;
          hybrid_score: number;
          id: string;
          image_ids: string[];
          images: Json;
          page_number: number;
          retrieval_synopsis: string;
          rrf_score: number;
          section_heading: string;
          similarity: number;
          source_metadata: Json;
          text_rank: number;
          title: string;
        }[];
      };
      match_document_chunks_text: {
        Args: {
          document_filters?: string[] | null;
          match_count?: number;
          owner_filter?: string | null;
          query_text: string;
        };
        Returns: {
          chunk_index: number;
          content: string;
          document_id: string;
          document_labels: Json;
          document_summary: string;
          file_name: string;
          hybrid_score: number;
          id: string;
          image_ids: string[];
          images: Json;
          page_number: number;
          retrieval_synopsis: string;
          section_heading: string;
          similarity: number;
          source_metadata: Json;
          text_rank: number;
          title: string;
        }[];
      };
      match_document_embedding_fields_hybrid: {
        Args: {
          document_filters?: string[] | null;
          match_count?: number;
          min_similarity?: number;
          owner_filter?: string | null;
          query_embedding: Vector;
          query_text: string;
        };
        Returns: {
          content: string;
          document_id: string;
          field_type: string;
          hybrid_score: number;
          id: string;
          similarity: number;
          source_chunk_id: string;
          text_rank: number;
        }[];
      };
      match_document_embedding_fields_text: {
        Args: {
          document_filters?: string[] | null;
          match_count?: number;
          min_text_rank?: number;
          owner_filter?: string | null;
          query_text: string;
        };
        Returns: {
          content: string;
          document_id: string;
          field_type: string;
          id: string;
          source_chunk_id: string;
          text_rank: number;
        }[];
      };
      match_document_index_units_hybrid: {
        Args: {
          document_filters?: string[] | null;
          match_count?: number;
          min_similarity?: number;
          owner_filter?: string | null;
          query_embedding: Vector;
          query_text: string;
        };
        Returns: {
          content: string;
          document_id: string;
          extraction_mode: string;
          heading_path: string[];
          hybrid_score: number;
          id: string;
          metadata: Json;
          normalized_terms: string[];
          page_end: number;
          page_start: number;
          quality_score: number;
          similarity: number;
          source_chunk_id: string;
          source_image_id: string;
          source_span: Json;
          text_rank: number;
          title: string;
          unit_type: string;
        }[];
      };
      match_document_lookup_chunks_text: {
        Args: {
          document_filters: string[] | null;
          match_count?: number;
          owner_filter?: string | null;
          query_text: string;
        };
        Returns: {
          anchor_id: string;
          chunk_index: number;
          content: string;
          document_id: string;
          heading_level: number;
          id: string;
          image_ids: string[];
          page_number: number;
          parent_heading: string;
          retrieval_synopsis: string;
          section_heading: string;
          section_path: string[];
          text_rank: number;
        }[];
      };
      match_document_memory_cards_hybrid: {
        Args: {
          document_filters?: string[] | null;
          match_count?: number;
          min_similarity?: number;
          owner_filter?: string | null;
          query_embedding: Vector;
          query_text: string;
        };
        Returns: {
          card_type: string;
          confidence: number;
          content: string;
          document_id: string;
          hybrid_score: number;
          id: string;
          metadata: Json;
          normalized_terms: string[];
          owner_id: string;
          page_number: number;
          rrf_score: number;
          section_id: string;
          similarity: number;
          source_chunk_ids: string[];
          source_image_ids: string[];
          text_rank: number;
          title: string;
        }[];
      };
      match_document_memory_cards_hybrid_v2: {
        Args: {
          document_filters?: string[] | null;
          match_count?: number;
          min_similarity?: number;
          owner_filter?: string | null;
          query_embedding: Vector;
          query_text: string;
        };
        Returns: {
          card_type: string;
          confidence: number;
          content: string;
          document_id: string;
          hybrid_score: number;
          id: string;
          metadata: Json;
          normalized_terms: string[];
          owner_id: string;
          page_number: number;
          rrf_score: number;
          section_id: string;
          similarity: number;
          source_chunk_ids: string[];
          source_image_ids: string[];
          text_rank: number;
          title: string;
        }[];
      };
      match_document_table_facts_text: {
        Args: {
          document_filters?: string[] | null;
          match_count?: number;
          owner_filter?: string | null;
          query_text: string;
        };
        Returns: {
          action: string;
          clinical_parameter: string;
          document_id: string;
          id: string;
          match_reason: string;
          page_number: number;
          row_label: string;
          source_chunk_id: string;
          source_image_id: string;
          table_title: string;
          text_rank: number;
          threshold_value: string;
        }[];
      };
      match_documents_for_query: {
        Args: {
          match_count?: number;
          owner_filter?: string | null;
          query_text: string;
        };
        Returns: {
          chunk_count: number;
          file_name: string;
          id: string;
          image_count: number;
          match_reason: string;
          metadata: Json;
          owner_id: string;
          page_count: number;
          status: string;
          text_rank: number;
          title: string;
        }[];
      };
      purge_expired_rag_queries: {
        Args: { p_retention_days?: number };
        Returns: number;
      };
      refresh_import_batch_status: {
        Args: { p_batch_id: string };
        Returns: Json;
      };
      repair_enrichment_quality_batch: {
        Args: { p_limit?: number };
        Returns: Json;
      };
      repair_strict_enrichment_gate_batch: {
        Args: { p_limit?: number };
        Returns: {
          counts: Json;
          document_id: string;
          missing: string[];
          presence: Json;
          repaired: string[];
          status: string;
        }[];
      };
      reset_document_index: {
        Args: { p_document_id: string };
        Returns: undefined;
      };
      run_all_visual_eval_cases: { Args: { p_limit?: number }; Returns: Json };
      run_visual_eval_case: {
        Args: { p_case_id: string; p_limit?: number };
        Returns: Json;
      };
      search_document_chunks: {
        Args: {
          match_count?: number;
          p_document_id: string;
          p_owner_id?: string;
          p_query: string;
        };
        Returns: {
          chunk_index: number;
          content: string;
          id: string;
          image_ids: string[];
          page_number: number;
          section_heading: string;
          text_rank: number;
          trigram_score: number;
        }[];
      };
      search_schema_health: { Args: never; Returns: Json };
      stamp_document_deep_memory_version: {
        Args: { p_document_id: string; p_version: string };
        Returns: undefined;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
