"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type ICD10Code = {
  id: number;
  code: string;
  description: string;
  category: string | null;
};

type ICD10SearchProps = {
  value?: ICD10Code | null;
  onSelect: (code: ICD10Code | null) => void;
  label?: string;
};

export default function ICD10Search({
  value,
  onSelect,
  label = "ICD-10 diagnosis",
}: ICD10SearchProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ICD10Code[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      searchCodes();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [search]);

  async function searchCodes() {
    const cleanSearch = search.trim();

    if (cleanSearch.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);

    const safeSearch = cleanSearch
      .replace(/[%_,()]/g, " ")
      .trim();

    const { data, error } = await supabase
      .from("icd10_codes")
      .select("id, code, description, category")
      .eq("active", true)
      .or(
        `code.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`
      )
      .order("code")
      .limit(20);

    if (error) {
      console.error("ICD-10 search error:", error);
      setResults([]);
    } else {
      setResults(data || []);
    }

    setLoading(false);
  }

  function selectCode(code: ICD10Code) {
    onSelect(code);
    setSearch(`${code.code} — ${code.description}`);
    setShowResults(false);
  }

  function clearSelection() {
    onSelect(null);
    setSearch("");
    setResults([]);
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <label
        style={{
          display: "block",
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        {label}
      </label>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          value={search}
          placeholder="Search by code or diagnosis..."
          onFocus={() => setShowResults(true)}
          onChange={(event) => {
            setSearch(event.target.value);
            setShowResults(true);

            if (value) {
              onSelect(null);
            }
          }}
          style={{
            width: "100%",
            padding: "12px",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
          }}
        />

        {(value || search) && (
          <button
            type="button"
            onClick={clearSelection}
            style={{
              padding: "0 14px",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              background: "white",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        )}
      </div>

      {showResults && search.trim().length >= 2 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 1000,
            marginTop: 4,
            maxHeight: 300,
            overflowY: "auto",
            background: "white",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
          }}
        >
          {loading && (
            <div style={{ padding: 12 }}>Searching ICD-10 codes...</div>
          )}

          {!loading && results.length === 0 && (
            <div style={{ padding: 12 }}>
              No matching ICD-10 codes found.
            </div>
          )}

          {!loading &&
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectCode(item)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: 12,
                  textAlign: "left",
                  border: "none",
                  borderBottom: "1px solid #e2e8f0",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                <strong>{item.code}</strong>

                <div style={{ marginTop: 3 }}>
                  {item.description}
                </div>

                {item.category && (
                  <small style={{ color: "#64748b" }}>
                    {item.category}
                  </small>
                )}
              </button>
            ))}
        </div>
      )}

      {value && (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 8,
            background: "#eff6ff",
          }}
        >
          Selected: <strong>{value.code}</strong> —{" "}
          {value.description}
        </div>
      )}
    </div>
  );
}
