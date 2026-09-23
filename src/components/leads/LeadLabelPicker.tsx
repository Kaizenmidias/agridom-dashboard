import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LEAD_LABEL_COLORS } from "@/constants/lead-options";
import { commercialEntitiesAPI } from "@/services/commercial-entities";
import type { LeadLabel } from "@/types/lead";
import { slugify } from "@/utils/lead-formatters";

const ADD_NEW_VALUE = "__add_new_label__";
const LEGACY_LABEL_LIBRARY_KEY = "kaizen.lead.labels";

function mergeLabels(...groups: Array<LeadLabel[] | undefined>) {
  const map = new Map<string, LeadLabel>();

  groups.flatMap((group) => group || []).forEach((label) => {
    const key = slugify(label.name);
    if (!map.has(key)) {
      map.set(key, {
        id: label.id || key,
        name: label.name,
        color: label.color || LEAD_LABEL_COLORS[0].value,
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function LeadLabelPicker({
  labels,
  availableLabels,
  onChange,
}: {
  labels: LeadLabel[];
  availableLabels?: LeadLabel[];
  onChange: (labels: LeadLabel[]) => void;
}) {
  const [libraryLabels, setLibraryLabels] = useState<LeadLabel[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(LEAD_LABEL_COLORS[0].value);
  const [selectValue, setSelectValue] = useState<string | undefined>();

  useEffect(() => {
    void commercialEntitiesAPI.getLabels()
      .then(async ({ labels: items }) => {
        let persisted = items.map((item) => ({ ...item, id: String(item.id) }));
        const legacyRaw = localStorage.getItem(LEGACY_LABEL_LIBRARY_KEY);
        if (legacyRaw) {
          const legacy = JSON.parse(legacyRaw) as LeadLabel[];
          for (const label of legacy) {
            if (persisted.some((item) => slugify(item.name) === slugify(label.name))) continue;
            const created = await commercialEntitiesAPI.createLabel(label.name, label.color);
            persisted = [...persisted, { ...created, id: String(created.id) }];
          }
          localStorage.removeItem(LEGACY_LABEL_LIBRARY_KEY);
        }
        setLibraryLabels(persisted);
      })
      .catch(() => setLibraryLabels([]));
  }, []);

  const options = useMemo(
    () => mergeLabels(libraryLabels, availableLabels, labels),
    [availableLabels, labels, libraryLabels]
  );

  const selectedIds = new Set(labels.map((label) => slugify(label.name)));

  const selectLabel = (value: string) => {
    setSelectValue(undefined);
    if (value === ADD_NEW_VALUE) {
      setAdding(true);
      return;
    }

    const nextLabel = options.find((label) => label.id === value);
    if (!nextLabel || selectedIds.has(slugify(nextLabel.name))) return;
    onChange([...labels, nextLabel]);
  };

  const removeLabel = (id: string) => {
    onChange(labels.filter((label) => label.id !== id));
  };

  const editLabel = async (label: LeadLabel) => {
    const name = window.prompt("Nome da etiqueta", label.name)?.trim();
    if (!name || name === label.name) return;
    const updated = await commercialEntitiesAPI.updateLabel(label.id, { name });
    const next = { ...updated, id: String(updated.id) };
    setLibraryLabels((current) => current.map((item) => item.id === label.id ? next : item));
    onChange(labels.map((item) => item.id === label.id ? next : item));
  };

  const createLabel = async () => {
    const name = newName.trim();
    if (!name) return;

    const created = await commercialEntitiesAPI.createLabel(name, newColor);
    const label = { id: String(created.id), name: created.name, color: created.color };
    const nextLibrary = mergeLabels(libraryLabels, [label]);
    setLibraryLabels(nextLibrary);
    onChange([...labels.filter((item) => slugify(item.name) !== slugify(name)), label]);
    setNewName("");
    setNewColor(LEAD_LABEL_COLORS[0].value);
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {labels.map((label) => (
          <span key={label.id} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-white" style={{ backgroundColor: label.color }}>
            {label.name}
            <button type="button" title="Editar etiqueta" onClick={() => void editLabel(label)} className="rounded-sm opacity-80 hover:opacity-100">
              <Pencil className="h-3 w-3" />
            </button>
            <button type="button" onClick={() => removeLabel(label.id)} className="rounded-sm opacity-80 hover:opacity-100">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>

      <Select value={selectValue} onValueChange={selectLabel}>
        <SelectTrigger>
          <SelectValue placeholder="Selecionar etiqueta" />
        </SelectTrigger>
        <SelectContent>
          {options.map((label) => (
            <SelectItem key={label.id} value={label.id} disabled={selectedIds.has(slugify(label.name))}>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color }} />
                {label.name}
              </span>
            </SelectItem>
          ))}
          <SelectItem value={ADD_NEW_VALUE}>
            <span className="inline-flex items-center gap-2">
              <Plus className="h-3.5 w-3.5" />
              Adicionar novo
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {adding ? (
        <div className="space-y-3 rounded-md border bg-muted/20 p-3">
          <div className="space-y-2">
            <Label>Nome da etiqueta</Label>
            <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Digite o nome" />
          </div>
          <div className="flex flex-wrap gap-2">
            {LEAD_LABEL_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                aria-label={`Selecionar ${color.name}`}
                className="h-7 w-7 rounded-full border-2 transition"
                style={{ backgroundColor: color.value, borderColor: newColor === color.value ? "#B7FF3C" : "transparent" }}
                onClick={() => setNewColor(color.value)}
              />
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button type="button" onClick={() => void createLabel()} disabled={!newName.trim()}>Adicionar</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
