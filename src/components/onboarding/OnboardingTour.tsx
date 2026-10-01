import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { completeOnboarding } from "../../utils/onboarding";
import { Button } from "../ui/Button";

type Placement = "right" | "bottom";
type TargetKey = "spaces" | "create-neuron" | "graph" | "create-connection" | "search";

type Step = {
  target: TargetKey;
  placement: Placement;
  title: string;
  description: string;
  emptyDescription?: string;
};

const STEPS: Step[] = [
  {
    target: "spaces",
    placement: "right",
    title: "Không gian",
    description: "Không gian giúp bạn chia kiến thức theo từng chủ đề, dự án hoặc công việc.",
  },
  {
    target: "create-neuron",
    placement: "bottom",
    title: "Tạo neuron",
    description: "Mỗi neuron là một đơn vị kiến thức. Tạo neuron để bắt đầu lưu và tổ chức thông tin.",
  },
  {
    target: "graph",
    placement: "right",
    title: "Chi tiết neuron",
    description: "Chọn một neuron để xem nội dung, viết Note Markdown và quản lý tài liệu.",
    emptyDescription: "Sau khi tạo neuron, bạn có thể chọn nó để xem nội dung, viết Note Markdown và quản lý tài liệu.",
  },
  {
    target: "create-connection",
    placement: "bottom",
    title: "Tạo liên kết",
    description: "Kết nối các neuron có liên quan để xây dựng mạng lưới kiến thức của bạn.",
  },
  {
    target: "search",
    placement: "right",
    title: "Tìm kiếm",
    description: "Search giúp bạn nhanh chóng tìm lại neuron và kiến thức đã lưu trong NeuroMind.",
  },
];

type OnboardingTourProps = {
  userId: string;
  open: boolean;
  hasNeurons: boolean;
  onClose: () => void;
};

type Box = { top: number; left: number; width: number; height: number };

function queryTarget(key: TargetKey) {
  return document.querySelector<HTMLElement>(`[data-onboarding="${key}"]`);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function tooltipPosition(target: Box | null, preferred: Placement, width: number, height: number, viewport: { w: number; h: number }) {
  const gap = 16;
  const pad = 12;
  const isMobile = viewport.w < 720;
  if (isMobile) {
    return {
      top: viewport.h - height - 12,
      left: clamp((viewport.w - width) / 2, pad, Math.max(pad, viewport.w - width - pad)),
    };
  }
  if (!target) {
    return {
      top: clamp((viewport.h - height) / 2, pad, Math.max(pad, viewport.h - height - pad)),
      left: clamp((viewport.w - width) / 2, pad, Math.max(pad, viewport.w - width - pad)),
    };
  }
  let top = preferred === "bottom" ? target.top + target.height + gap : target.top;
  let left = preferred === "right" ? target.left + target.width + gap : target.left;
  if (preferred === "bottom") {
    left = target.left + target.width / 2 - width / 2;
  }
  if (preferred === "right" && left + width > viewport.w - pad) {
    left = target.left - width - gap;
  }
  if (preferred === "bottom" && top + height > viewport.h - pad) {
    top = target.top - height - gap;
  }
  top = clamp(top, pad, Math.max(pad, viewport.h - height - pad));
  left = clamp(left, pad, Math.max(pad, viewport.w - width - pad));
  return { top, left };
}

export function OnboardingTour({ userId, open, hasNeurons, onClose }: OnboardingTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [skipConfirm, setSkipConfirm] = useState(false);
  const [targetBox, setTargetBox] = useState<Box | null>(null);
  const [tooltipBox, setTooltipBox] = useState({ top: 24, left: 24 });
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const description = step.target === "graph" && !hasNeurons && step.emptyDescription ? step.emptyDescription : step.description;

  const finish = () => {
    completeOnboarding(userId);
    setSkipConfirm(false);
    onClose();
  };

  const measure = () => {
    const element = queryTarget(step.target);
    const rect = element?.getBoundingClientRect();
    const nextTarget =
      rect && rect.width > 0 && rect.height > 0
        ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        : null;
    setTargetBox(nextTarget);
    const tooltip = dialogRef.current?.getBoundingClientRect();
    const width = tooltip?.width || Math.min(300, window.innerWidth - 32);
    const height = tooltip?.height || 180;
    setTooltipBox(
      tooltipPosition(nextTarget, step.placement, width, height, { w: window.innerWidth, h: window.innerHeight }),
    );
  };

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    let ticks = 0;
    const timer = window.setInterval(() => {
      measure();
      ticks += 1;
      if (ticks > 10) window.clearInterval(timer);
    }, 60);
    return () => window.clearInterval(timer);
  }, [open, stepIndex, hasNeurons, skipConfirm]);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setStepIndex(0);
    setSkipConfirm(false);
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    const frame = window.requestAnimationFrame(measure);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
      window.cancelAnimationFrame(frame);
      restoreFocusRef.current?.focus?.();
    };
  }, [open, userId]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const buttons = dialog?.querySelectorAll<HTMLButtonElement>("button");
    buttons?.[0]?.focus();
  }, [open, stepIndex, skipConfirm]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSkipConfirm(true);
        return;
      }
      if (skipConfirm) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (isLast) {
          completeOnboarding(userId);
          setSkipConfirm(false);
          onClose();
        } else {
          setStepIndex((value) => value + 1);
        }
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setStepIndex((value) => Math.max(0, value - 1));
      }
      if (event.key === "Tab") {
        const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
        if (!buttons.length) return;
        event.preventDefault();
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.shiftKey ? (index <= 0 ? buttons.length - 1 : index - 1) : (index + 1) % buttons.length;
        buttons[next]?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, skipConfirm, isLast, userId, stepIndex]);

  if (!open) return null;

  return (
    <div className="nm-onboarding" role="presentation">
      <div className={`nm-onboarding-scrim${targetBox ? " is-cutout" : ""}`} />
      {targetBox ? (
        <div
          className="nm-onboarding-spot"
          style={{
            top: targetBox.top - 4,
            left: targetBox.left - 4,
            width: targetBox.width + 8,
            height: targetBox.height + 8,
          }}
        />
      ) : null}
      <div
        ref={dialogRef}
        className={`nm-onboarding-tip${window.innerWidth < 720 ? " is-mobile" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        style={{ top: tooltipBox.top, left: tooltipBox.left }}
      >
        {skipConfirm ? (
          <>
            <p className="nm-onboarding-kicker">Bỏ qua hướng dẫn?</p>
            <h2 id={titleId}>Bạn vẫn có thể mở lại hướng dẫn sau.</h2>
            <p id={descId} className="nm-onboarding-copy">Mở lại bất cứ lúc nào trong Cài đặt.</p>
            <div className="nm-onboarding-actions">
              <Button variant="secondary" size="sm" onClick={() => setSkipConfirm(false)}>Tiếp tục hướng dẫn</Button>
              <Button variant="primary" size="sm" onClick={finish}>Bỏ qua</Button>
            </div>
          </>
        ) : (
          <>
            <p className="nm-onboarding-kicker">Bước {stepIndex + 1} / {STEPS.length}</p>
            <h2 id={titleId}>{step.title}</h2>
            <p id={descId} className="nm-onboarding-copy">{description}</p>
            <div className="nm-onboarding-actions">
              <Button variant="ghost" size="sm" onClick={() => setSkipConfirm(true)}>Bỏ qua</Button>
              {stepIndex > 0 ? (
                <Button variant="secondary" size="sm" onClick={() => setStepIndex((value) => value - 1)}>Quay lại</Button>
              ) : null}
              {isLast ? (
                <Button variant="primary" size="sm" onClick={finish}>Bắt đầu sử dụng</Button>
              ) : (
                <Button variant="primary" size="sm" onClick={() => setStepIndex((value) => value + 1)}>Tiếp theo</Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
