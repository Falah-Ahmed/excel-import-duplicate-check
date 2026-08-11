"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fieldLabel, t, type Lang } from "@/lib/labels";
import type { FamilyMemberView, FieldItem, RecordPayload } from "@/lib/record";
import styles from "./pdf-view.module.css";

type ApiResponse = {
  ok: boolean;
  error?: string;
  record?: RecordPayload;
};

function recordIdFromUrl() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return (params.get("name") || params.get("id") || "").trim();
}

export default function PdfView() {
  const [lang, setLang] = useState<Lang>("en");
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<RecordPayload | null>(null);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setId(recordIdFromUrl());
  }, []);

  const load = useCallback(async (name: string) => {
    if (!name) {
      setLoading(false);
      setError(null);
      setRecord(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/record?name=${encodeURIComponent(name)}`);
      const json: ApiResponse = await res.json();
      if (!json.ok || !json.record) {
        setRecord(null);
        setError(json.error || "Failed to load record");
        return;
      }
      setRecord(json.record);
    } catch {
      setError("Failed to load record");
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(id);
  }, [id, load]);

  const dir = lang === "ar" ? "rtl" : "ltr";

  const hideKey = (section: string, key: string, extra = "") =>
    `${section}:${extra}:${key}`;

  function toggle(key: string) {
    setHidden((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function setMany(keys: string[], hide: boolean) {
    setHidden((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = hide;
      return next;
    });
  }

  const extraKeys = useMemo(
    () => (record?.extra || []).map((f) => hideKey("extra", f.key)),
    [record]
  );

  return (
    <div className={styles.page} dir={dir} lang={lang}>
      <div className={styles.toolbar}>
        <div>
          <h1>{t("title", lang)}</h1>
          <p>{t("subtitle", lang)}</p>
        </div>
        <div className={styles.actions}>
          <div className={styles.lang}>
            <button
              type="button"
              className={lang === "en" ? styles.active : ""}
              onClick={() => setLang("en")}
            >
              English
            </button>
            <button
              type="button"
              className={lang === "ar" ? styles.active : ""}
              onClick={() => setLang("ar")}
            >
              العربية
            </button>
          </div>
          <button type="button" className={styles.print} onClick={() => window.print()}>
            {t("print", lang)}
          </button>
        </div>
      </div>

      {loading && <div className={styles.note}>{t("loading", lang)}</div>}
      {!loading && !id && <div className={styles.note}>{t("noRecord", lang)}</div>}
      {error && <pre className={styles.error}>{error}</pre>}

      {record && (
        <>
          <div className={styles.panel}>
            <button type="button" onClick={() => setMany(extraKeys, false)}>
              {t("showAll", lang)}
            </button>
            <button type="button" onClick={() => setMany(extraKeys, true)}>
              {t("hideAll", lang)}
            </button>
          </div>

          <article className={styles.sheet}>
            <header className={styles.sheetHead}>
              <div>
                <div className={styles.kicker}>{t("record", lang)}</div>
                <h2>{record.title}</h2>
                <div className={styles.meta}>{record.id}</div>
              </div>
            </header>

            <Section
              title={t("identity", lang)}
              fields={record.identity}
              lang={lang}
              hidden={hidden}
              section="identity"
              hideKey={hideKey}
              toggle={toggle}
            />

            {record.extra.length > 0 && (
              <Section
                title={t("extra", lang)}
                fields={record.extra}
                lang={lang}
                hidden={hidden}
                section="extra"
                hideKey={hideKey}
                toggle={toggle}
              />
            )}

            {record.family.length > 0 && (
              <section className={styles.block}>
                <h3>{t("family", lang)}</h3>
                {record.family.map((member, index) => (
                  <FamilyBlock
                    key={member.id}
                    member={member}
                    index={index}
                    lang={lang}
                    hidden={hidden}
                    hideKey={hideKey}
                    toggle={toggle}
                  />
                ))}
              </section>
            )}
          </article>
        </>
      )}
    </div>
  );
}

function Section({
  title,
  fields,
  lang,
  hidden,
  section,
  hideKey,
  toggle,
}: {
  title: string;
  fields: FieldItem[];
  lang: Lang;
  hidden: Record<string, boolean>;
  section: string;
  hideKey: (section: string, key: string, extra?: string) => string;
  toggle: (key: string) => void;
}) {
  return (
    <section className={styles.block}>
      <h3>{title}</h3>
      <dl className={styles.grid}>
        {fields.map((field) => {
          const key = hideKey(section, field.key);
          const isHidden = Boolean(hidden[key]);
          return (
            <div key={key} className={styles.row}>
              <dt>
                {fieldLabel(field.key, lang)}
                <button type="button" className={styles.hideBtn} onClick={() => toggle(key)}>
                  {isHidden ? t("show", lang) : t("hide", lang)}
                </button>
              </dt>
              <dd className={isHidden ? styles.hidden : ""}>
                {isHidden ? t("hidden", lang) : field.value || t("empty", lang)}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function FamilyBlock({
  member,
  index,
  lang,
  hidden,
  hideKey,
  toggle,
}: {
  member: FamilyMemberView;
  index: number;
  lang: Lang;
  hidden: Record<string, boolean>;
  hideKey: (section: string, key: string, extra?: string) => string;
  toggle: (key: string) => void;
}) {
  return (
    <div className={styles.member}>
      <h4>
        {t("member", lang)} {index + 1}
      </h4>
      <dl className={styles.grid}>
        {member.fields.map((field) => {
          const key = hideKey("family", field.key, member.id);
          const isHidden = Boolean(hidden[key]);
          return (
            <div key={key} className={styles.row}>
              <dt>
                {fieldLabel(field.key, lang)}
                <button type="button" className={styles.hideBtn} onClick={() => toggle(key)}>
                  {isHidden ? t("show", lang) : t("hide", lang)}
                </button>
              </dt>
              <dd className={isHidden ? styles.hidden : ""}>
                {isHidden ? t("hidden", lang) : field.value || t("empty", lang)}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
