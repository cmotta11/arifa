import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { FieldComment } from "../api/dd-api";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FieldCommentThreadProps {
  kycId: string;
  fieldName: string;
  comments: FieldComment[];
  onAdd: (text: string, parentId?: string) => void;
  onResolve: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FieldCommentThread({
  kycId: _kycId,
  fieldName: _fieldName,
  comments,
  onAdd,
  onResolve,
}: FieldCommentThreadProps) {
  const { t } = useTranslation("common");
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  // Separate root comments from replies
  const rootComments = comments.filter((c) => !c.parent_id);
  const repliesMap = new Map<string, FieldComment[]>();
  for (const c of comments) {
    if (c.parent_id) {
      const existing = repliesMap.get(c.parent_id) ?? [];
      existing.push(c);
      repliesMap.set(c.parent_id, existing);
    }
  }

  const allResolved = comments.length > 0 && comments.every((c) => c.resolved);

  const handleSubmit = () => {
    const text = newComment.trim();
    if (!text) return;
    onAdd(text);
    setNewComment("");
  };

  const handleReply = (parentId: string) => {
    const text = replyText.trim();
    if (!text) return;
    onAdd(text, parentId);
    setReplyText("");
    setReplyingTo(null);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    action: () => void,
  ) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      action();
    }
  };

  return (
    <div className="w-80 rounded-lg border border-gray-200 bg-white shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h4 className="text-sm font-semibold text-gray-900">
          {t("compliance.fieldComments.title", "Comments")}
        </h4>
        {comments.length > 0 && !allResolved && (
          <Button variant="ghost" size="sm" onClick={onResolve}>
            {t("compliance.fieldComments.resolveAll", "Resolve All")}
          </Button>
        )}
      </div>

      {/* Comments list */}
      <div className="max-h-64 overflow-y-auto">
        {comments.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-gray-400">
            {t("compliance.fieldComments.empty", "No comments yet")}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rootComments.map((comment) => {
              const replies = repliesMap.get(comment.id) ?? [];
              return (
                <li key={comment.id} className="px-4 py-3">
                  <CommentBubble
                    comment={comment}
                    onReply={() => setReplyingTo(comment.id)}
                  />
                  {/* Replies */}
                  {replies.length > 0 && (
                    <div className="ml-4 mt-2 space-y-2 border-l-2 border-gray-100 pl-3">
                      {replies.map((reply) => (
                        <CommentBubble key={reply.id} comment={reply} />
                      ))}
                    </div>
                  )}
                  {/* Reply input */}
                  {replyingTo === comment.id && (
                    <div className="ml-4 mt-2 flex gap-2">
                      <Textarea
                        className="resize-none text-xs"
                        rows={2}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) =>
                          handleKeyDown(e, () => handleReply(comment.id))
                        }
                        placeholder={t(
                          "compliance.fieldComments.replyPlaceholder",
                          "Reply...",
                        )}
                      />
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleReply(comment.id)}
                          disabled={!replyText.trim()}
                        >
                          {t("common.submit", "Send")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyText("");
                          }}
                        >
                          {t("common.cancel", "Cancel")}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* New comment input */}
      <div className="border-t border-gray-200 px-4 py-3">
        <div className="flex gap-2">
          <Textarea
            className="resize-none"
            rows={2}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, handleSubmit)}
            placeholder={t(
              "compliance.fieldComments.placeholder",
              "Add a comment...",
            )}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!newComment.trim()}
            className="self-end"
          >
            {t("common.submit", "Send")}
          </Button>
        </div>
        <p className="mt-1 text-xs text-gray-400">
          {t(
            "compliance.fieldComments.shortcut",
            "Ctrl+Enter to send",
          )}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comment Bubble
// ---------------------------------------------------------------------------

interface CommentBubbleProps {
  comment: FieldComment;
  onReply?: () => void;
}

function CommentBubble({ comment, onReply }: CommentBubbleProps) {
  const { t } = useTranslation("common");
  return (
    <div
      className={`rounded-md px-3 py-2 text-xs ${
        comment.resolved ? "bg-gray-50 text-gray-400" : "bg-blue-50 text-gray-700"
      }`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-semibold text-gray-900">
          {comment.author_name}
        </span>
        <span className="text-gray-400">
          {formatTimestamp(comment.created_at)}
        </span>
      </div>
      <p className={`whitespace-pre-wrap ${comment.resolved ? "line-through" : ""}`}>
        {comment.text}
      </p>
      {onReply && !comment.resolved && (
        <button
          type="button"
          onClick={onReply}
          className="mt-1 text-xs font-medium text-primary hover:underline"
        >
          {t("compliance.fieldComments.reply", "Reply")}
        </button>
      )}
      {comment.resolved && (
        <span className="mt-1 inline-block text-xs italic text-gray-400">
          {t("compliance.fieldComments.resolved", "Resolved")}
        </span>
      )}
    </div>
  );
}
