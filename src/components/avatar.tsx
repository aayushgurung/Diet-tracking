import { useId } from "react";
import { cn } from "@/lib/utils";

export type AvatarState = "neutral" | "happy" | "caution" | "strong-warning" | "review";

interface AvatarProps {
  state?: AvatarState;
  message?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const messages: Record<AvatarState, string> = {
  neutral: "A little food memory, just for you.",
  happy: "Added to your journal!",
  caution: "You previously flagged this food.",
  "strong-warning": "You previously reported a significant reaction. You can review your notes.",
  review: "Your observations, all in one place.",
};

/** The expression reflects journal records, never an inferred medical risk. */
export function Avatar({ state = "neutral", message, className, size = "md" }: AvatarProps) {
  const id = useId().replace(/:/g, "");
  const concerned = state === "caution" || state === "strong-warning";
  return (
    <div className={cn("companion", `companion-${size}`, `companion-${state}`, className)}>
      <svg className="companion-illustration" viewBox="0 0 180 176" fill="none" role="img" aria-label={`Friendly sprout companion, ${state.replace("-", " ")}`}>
        <defs>
          <linearGradient id={`${id}-body`} x1="61" y1="61" x2="126" y2="151" gradientUnits="userSpaceOnUse">
            <stop stopColor="#E2EBC8" /><stop offset="1" stopColor="#B5CC97" />
          </linearGradient>
        </defs>
        <ellipse cx="89" cy="158" rx="47" ry="7" fill="#3C6045" fillOpacity=".08" />
        <path d="M86 59C88 43 91 34 99 28" stroke="#688552" strokeWidth="5" strokeLinecap="round" />
        <path d="M92 37C90 17 68 14 60 19C63 34 75 42 92 37Z" fill="#8DAE71" />
        <path d="M94 35C100 14 119 14 127 19C123 34 111 41 94 35Z" fill="#648C5C" />
        <path d="M63 65C70 47 104 43 115 66C119 77 122 84 131 96C154 125 137 154 91 155C46 156 28 131 46 104C55 91 60 78 63 65Z" fill={`url(#${id}-body)`} />
        <path d="M52 111C43 108 35 113 32 120" stroke="#9AB77D" strokeWidth="7" strokeLinecap="round" />
        <path d={concerned ? "M129 106C139 99 143 90 142 84" : "M129 111C139 108 144 114 148 121"} stroke="#9AB77D" strokeWidth="7" strokeLinecap="round" />
        <path d="M69 152L64 159M111 152L117 159" stroke="#88A66E" strokeWidth="7" strokeLinecap="round" />
        <ellipse cx="66" cy="116" rx="8" ry="4" fill="#E8A897" fillOpacity=".65" />
        <ellipse cx="112" cy="116" rx="8" ry="4" fill="#E8A897" fillOpacity=".65" />
        {state === "happy" ? <>
          <path d="M68 104C71 100 75 100 78 104M101 104C104 100 108 100 111 104" stroke="#35563E" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M81 116C85 124 94 124 98 116" fill="#35563E" stroke="#35563E" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M28 73V83M23 78H33M145 54V62M141 58H149" stroke="#D2AE65" strokeWidth="2.5" strokeLinecap="round" />
        </> : <>
          <ellipse className="companion-eye" cx="74" cy="105" rx="3" ry={state === "review" ? "3.5" : "4"} fill="#35563E" />
          <ellipse className="companion-eye" cx="105" cy="105" rx="3" ry="4" fill="#35563E" />
          {concerned && <path d="M68 96L78 99M101 99L111 96" stroke="#35563E" strokeWidth="2.8" strokeLinecap="round" />}
          <path d={concerned ? "M84 121Q89 116 95 121" : state === "review" ? "M84 119Q89 121 94 118" : "M82 117Q89 125 97 117"} stroke="#35563E" strokeWidth="2.8" strokeLinecap="round" />
        </>}
        {concerned && <g>
          <rect x="130" y="58" width="31" height="31" rx="11" fill={state === "strong-warning" ? "#B75C51" : "#DDAD5F"} />
          <path d="M145.5 66V75M145.5 80V80.2" stroke="white" strokeWidth="3" strokeLinecap="round" />
        </g>}
        {state === "review" && <g>
          <circle cx="133" cy="83" r="12" fill="#FBF9F2" stroke="#688552" strokeWidth="3" />
          <path d="M141 92L150 101" stroke="#688552" strokeWidth="4" strokeLinecap="round" />
          <path d="M129 83L132 86L138 79" stroke="#8DAE71" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
        </g>}
      </svg>
      <p className="companion-message">{message ?? messages[state]}</p>
    </div>
  );
}
