import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectForm } from "@/components/ProjectForm";
import { TaskCard } from "@/components/TaskCard";
import { api } from "@/lib/api";
import type { Task } from "@/lib/types";

const task: Task = {
  id: "t1",
  projectId: "p1",
  projectName: "Website",
  title: "Design homepage",
  description: "",
  status: "todo",
  priority: "high",
  dueDate: "2020-01-01",
  overdue: true,
  createdAt: "2020-01-01T00:00:00Z",
  updatedAt: "2020-01-01T00:00:00Z",
};

describe("TaskCard", () => {
  it("flags overdue tasks and reports status changes", () => {
    const onStatusChange = vi.fn();
    render(
      <TaskCard task={task} showProject busy={false} onStatusChange={onStatusChange} onEdit={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByText(/Overdue/)).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Status of Design homepage"), { target: { value: "done" } });
    expect(onStatusChange).toHaveBeenCalledWith("done");
  });
});

describe("ProjectForm", () => {
  it("blocks an empty name without calling the API", () => {
    const create = vi.spyOn(api, "createProject");
    render(<ProjectForm onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(screen.getByText("Name is required")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });
});
