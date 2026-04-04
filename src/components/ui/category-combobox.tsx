"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

interface CategoryComboboxProps {
  categories: Category[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onCreateNew?: (name: string) => void;
}

export function CategoryCombobox({
  categories,
  value,
  onChange,
  placeholder = "Selecionar categoria...",
  onCreateNew,
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = categories.find((c) => c.name === value);
  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );
  const showCreate = onCreateNew && search.trim() && !categories.find(
    (c) => c.name.toLowerCase() === search.trim().toLowerCase()
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-normal hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        aria-expanded={open}
      >
        {selected ? (
          <span>{selected.icon ? `${selected.icon} ${selected.name}` : selected.name}</span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>
              {showCreate ? null : "Nenhuma categoria encontrada."}
            </CommandEmpty>
            {value && (
              <CommandGroup>
                <CommandItem
                  value="__clear__"
                  onSelect={() => { onChange(""); setOpen(false); setSearch(""); }}
                  className="text-muted-foreground"
                >
                  <Check className="size-4 mr-2 opacity-0" />
                  Sem categoria
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {filtered.map((cat) => (
                <CommandItem
                  key={cat.id}
                  value={cat.name}
                  onSelect={() => {
                    onChange(cat.name);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn("size-4 mr-2", value === cat.name ? "opacity-100" : "opacity-0")}
                  />
                  {cat.icon ? `${cat.icon} ${cat.name}` : cat.name}
                </CommandItem>
              ))}
            </CommandGroup>
            {showCreate && (
              <CommandGroup>
                <CommandItem
                  value={`__create__${search}`}
                  onSelect={() => {
                    onCreateNew?.(search.trim());
                    onChange(search.trim());
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <span className="text-muted-foreground mr-2">+</span>
                  Criar &quot;{search.trim()}&quot;
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
