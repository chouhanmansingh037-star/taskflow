import { TaskWorkspace } from "@/components/TaskWorkspace";

export default function TasksPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tasks</h1>
          <p>Organize tasks and monitor delivery.</p>
        </div>
      </div>
      <TaskWorkspace />
    </>
  );
}
