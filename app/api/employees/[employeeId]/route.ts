import { NextRequest, NextResponse } from "next/server";
import { updateEmployee } from "@/lib/googleSheets";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId } = await params;
    const body = await request.json();

    await updateEmployee({
      employeeId,

      name: body.name,
      position: body.position,

      skills: body.skills || [],

      status: body.status,

      maxStations: Number(body.maxStations),

      shift: body.shift,

      employmentType: body.employmentType,
    });

    return NextResponse.json({
      success: true,
      message: "Employee updated successfully.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to update employee",
      },
      { status: 500 }
    );
  }
}