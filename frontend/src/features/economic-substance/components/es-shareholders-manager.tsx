import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface ShareholderRow {
  name: string;
  type: string;
  percentage: number;
}

interface ESShareholdersManagerProps {
  shareholders: ShareholderRow[];
  onChange: (shareholders: ShareholderRow[]) => void;
  disabled?: boolean;
}

const EMPTY_ROW: ShareholderRow = { name: "", type: "Natural", percentage: 0 };

export function ESShareholdersManager({
  shareholders,
  onChange,
  disabled = false,
}: ESShareholdersManagerProps) {
  const { t } = useTranslation();
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<ShareholderRow>(EMPTY_ROW);

  const totalPercentage = shareholders.reduce(
    (sum, s) => sum + (s.percentage || 0),
    0,
  );
  const percentageValid = totalPercentage <= 100;

  const handleAdd = () => {
    setEditIdx(shareholders.length);
    setEditRow({ ...EMPTY_ROW });
  };

  const handleEdit = (idx: number) => {
    setEditIdx(idx);
    setEditRow({ ...shareholders[idx] });
  };

  const handleSave = () => {
    if (editIdx === null) return;
    if (!editRow.name.trim() || editRow.percentage <= 0) return;

    const updated = [...shareholders];
    if (editIdx >= shareholders.length) {
      updated.push({ ...editRow });
    } else {
      updated[editIdx] = { ...editRow };
    }
    onChange(updated);
    setEditIdx(null);
    setEditRow(EMPTY_ROW);
  };

  const handleCancel = () => {
    setEditIdx(null);
    setEditRow(EMPTY_ROW);
  };

  const handleRemove = (idx: number) => {
    const updated = shareholders.filter((_, i) => i !== idx);
    onChange(updated);
    if (editIdx === idx) {
      setEditIdx(null);
      setEditRow(EMPTY_ROW);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">
          {t("es.shareholders.title")}
        </h4>
        {!disabled && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAdd}
            disabled={editIdx !== null}
          >
            {t("es.shareholders.add")}
          </Button>
        )}
      </div>

      {/* Table — ACCEPTED EXCEPTION: intentionally not using DataTable due to inline editing/delete actions per row */}
      {shareholders.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-500">
                  {t("es.shareholders.name")}
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-500">
                  {t("es.shareholders.type")}
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">
                  {t("es.shareholders.percentage")}
                </th>
                {!disabled && (
                  <th className="px-4 py-2 text-right font-medium text-gray-500">
                    {t("common.actions")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {shareholders.map((row, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-2 text-gray-700">{row.name}</td>
                  <td className="px-4 py-2 text-gray-700">{row.type}</td>
                  <td className="px-4 py-2 text-right text-gray-700">
                    {row.percentage.toFixed(2)}%
                  </td>
                  {!disabled && (
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(idx)}
                          className="text-xs text-primary hover:underline"
                          disabled={editIdx !== null}
                        >
                          {t("common.edit")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(idx)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          {t("common.delete")}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {shareholders.length === 0 && editIdx === null && (
        <p className="py-4 text-center text-sm text-gray-400">
          {t("es.shareholders.empty")}
        </p>
      )}

      {/* Edit / Add form */}
      {editIdx !== null && (
        <div className="rounded-md border border-primary/20 bg-primary/5 p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">
            {editIdx >= shareholders.length
              ? t("es.shareholders.addNew")
              : t("es.shareholders.editing")}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label={t("es.shareholders.name")}
              value={editRow.name}
              onChange={(e) =>
                setEditRow({ ...editRow, name: e.target.value })
              }
              placeholder={t("es.shareholders.namePlaceholder")}
            />
            <Select
              label={t("es.shareholders.type")}
              value={editRow.type}
              onChange={(e) =>
                setEditRow({ ...editRow, type: e.target.value })
              }
              options={[
                { value: "Natural", label: t("es.shareholders.natural") },
                { value: "Legal", label: t("es.shareholders.legal") },
              ]}
            />
            <Input
              label={t("es.shareholders.percentage")}
              type="number"
              min={0.01}
              max={100}
              step={0.01}
              value={editRow.percentage || ""}
              onChange={(e) =>
                setEditRow({
                  ...editRow,
                  percentage: parseFloat(e.target.value) || 0,
                })
              }
              placeholder="0.00"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={handleCancel}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={
                !editRow.name.trim() ||
                editRow.percentage <= 0 ||
                editRow.percentage > 100
              }
            >
              {t("common.save")}
            </Button>
          </div>
        </div>
      )}

      {/* Total percentage */}
      <div
        className={`flex items-center justify-between rounded-md px-4 py-2 text-sm font-medium ${
          percentageValid
            ? "bg-gray-50 text-gray-700"
            : "bg-red-50 text-red-700"
        }`}
      >
        <span>{t("es.shareholders.total")}</span>
        <span>{totalPercentage.toFixed(2)}%</span>
      </div>
      {!percentageValid && (
        <p className="text-xs text-red-600">
          {t("es.shareholders.exceedsMax")}
        </p>
      )}
    </div>
  );
}
