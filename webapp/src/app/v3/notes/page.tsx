"use client";

import { useState } from "react";
import {
  Plus,
  FileText,
  List,
  LayoutGrid,
  Settings,
  ArrowUpDown,
  X,
  Building2,
  Calendar,
} from "lucide-react";

interface Note {
  id: string;
  title: string;
  linkedRecord?: string;
  createdAt: string;
  content?: string;
}

function NoteEditor({ note, onClose }: { note: Note | null; onClose: () => void }) {
  const [title, setTitle] = useState(note?.title || "Untitled note");

  return (
    <div className="v3-modal-overlay" onClick={onClose}>
      <div
        className="v3-modal"
        style={{ maxWidth: 640, maxHeight: "80vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="v3-modal-header">
          <div className="v3-modal-title">
            <Building2 size={14} style={{ color: "var(--v3-accent-blue)" }} />
            {note?.linkedRecord || "New Note"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button className="v3-topbar-btn-icon" title="Minimize" style={{ width: 24, height: 24 }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>−</span>
            </button>
            <button className="v3-topbar-btn-icon" title="Expand" style={{ width: 24, height: 24 }}>
              <span style={{ fontSize: 12 }}>⤢</span>
            </button>
            <button className="v3-topbar-btn-icon" onClick={onClose} style={{ width: 24, height: 24 }}>
              <X size={14} />
            </button>
          </div>
        </div>
        <div className="v3-modal-body" style={{ flex: 1, overflow: "auto" }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--v3-text-primary)",
              fontSize: 20,
              fontWeight: 600,
              width: "100%",
              outline: "none",
              marginBottom: 12,
            }}
            placeholder="Untitled note"
          />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <button className="v3-toolbar-btn">
              <Building2 size={12} />
              {note?.linkedRecord || "Link a record"}
            </button>
            <button className="v3-toolbar-btn">
              <Calendar size={12} />
              Link a meeting
            </button>
          </div>
          <div
            contentEditable
            style={{
              minHeight: 200,
              outline: "none",
              color: "var(--v3-text-secondary)",
              fontSize: 14,
              lineHeight: 1.7,
            }}
            data-placeholder="Start typing, or create a template"
          />
        </div>
      </div>
    </div>
  );
}

export default function V3NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const handleNewNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: "Untitled note",
      createdAt: new Date().toISOString(),
    };
    setEditingNote(newNote);
    setShowEditor(true);
  };

  return (
    <div>
      <div className="v3-page-header">
        <div className="v3-page-header-left">
          <span className="v3-page-header-title">
            <FileText size={16} />
            Notes
          </span>
        </div>
        <div className="v3-page-header-right">
          <button className="v3-btn-primary" onClick={handleNewNote}>
            <Plus size={14} />
            New note
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="v3-tabs">
        <button className="v3-tab active">
          Notes <span className="v3-tab-count">{notes.length}</span>
        </button>
        <button className="v3-tab">
          Templates <span className="v3-tab-count">0</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="v3-toolbar">
        <button className="v3-toolbar-btn active">
          <ArrowUpDown size={12} />
          Sorted by Creation date
        </button>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
          <button
            className={`v3-toolbar-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
          >
            <List size={12} />
          </button>
          <button
            className={`v3-toolbar-btn ${viewMode === "grid" ? "active" : ""}`}
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid size={12} />
          </button>
          <button className="v3-toolbar-btn">
            <Settings size={12} />
            View settings
          </button>
        </div>
      </div>

      {/* Content */}
      {notes.length === 0 ? (
        <div className="v3-empty-state">
          <div style={{ width: 80, height: 80, marginBottom: 20, opacity: 0.15 }}>
            <FileText size={80} strokeWidth={0.8} />
          </div>
          <h3>Notes</h3>
          <p>No notes yet! Create your first note to get started.</p>
          <button className="v3-btn-primary" style={{ marginTop: 20 }} onClick={handleNewNote}>
            <Plus size={14} />
            New note
          </button>
        </div>
      ) : (
        <div style={{ padding: 24 }}>
          {viewMode === "list" ? (
            <table className="v3-table">
              <thead>
                <tr>
                  <th>Note</th>
                  <th>Linked record</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((note) => (
                  <tr
                    key={note.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      setEditingNote(note);
                      setShowEditor(true);
                    }}
                  >
                    <td className="v3-table-link">{note.title}</td>
                    <td>{note.linkedRecord || "—"}</td>
                    <td>{new Date(note.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="v3-report-grid">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="v3-report-card"
                  onClick={() => {
                    setEditingNote(note);
                    setShowEditor(true);
                  }}
                >
                  <h4 style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{note.title}</h4>
                  <p style={{ fontSize: 12, color: "var(--v3-text-tertiary)" }}>
                    {new Date(note.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showEditor && (
        <NoteEditor
          note={editingNote}
          onClose={() => {
            setShowEditor(false);
            if (editingNote && !notes.find((n) => n.id === editingNote.id)) {
              setNotes([editingNote, ...notes]);
            }
          }}
        />
      )}
    </div>
  );
}
