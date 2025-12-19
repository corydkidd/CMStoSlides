export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          is_admin: boolean
          is_active: boolean
          template_path: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          is_admin?: boolean
          is_active?: boolean
          template_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          is_admin?: boolean
          is_active?: boolean
          template_path?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      description_documents: {
        Row: {
          id: string
          user_id: string
          content: string
          version: number
          is_current: boolean
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          user_id: string
          content: string
          version?: number
          is_current?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          content?: string
          version?: number
          is_current?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
      }
      conversion_jobs: {
        Row: {
          id: string
          user_id: string
          status: string
          input_filename: string
          input_path: string
          input_size_bytes: number | null
          extracted_text: string | null
          description_doc_id: string | null
          processing_started_at: string | null
          processing_completed_at: string | null
          output_filename: string | null
          output_path: string | null
          output_size_bytes: number | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          status?: string
          input_filename: string
          input_path: string
          input_size_bytes?: number | null
          extracted_text?: string | null
          description_doc_id?: string | null
          processing_started_at?: string | null
          processing_completed_at?: string | null
          output_filename?: string | null
          output_path?: string | null
          output_size_bytes?: number | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          status?: string
          input_filename?: string
          input_path?: string
          input_size_bytes?: number | null
          extracted_text?: string | null
          description_doc_id?: string | null
          processing_started_at?: string | null
          processing_completed_at?: string | null
          output_filename?: string | null
          output_path?: string | null
          output_size_bytes?: number | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
