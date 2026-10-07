import {
  createContext,
  Fragment,
  memo,
  startTransition,
  Suspense,
  use,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, ChevronLeft, ChevronRight, Share } from "lucide-react";
