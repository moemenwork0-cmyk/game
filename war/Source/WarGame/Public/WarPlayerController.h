#pragma once

#include "GameFramework/PlayerController.h"
#include "WarPlayerController.generated.h"

class SWarTouchControls;

UCLASS()
class WARGAME_API AWarPlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	AWarPlayerController();

	SWarTouchControls* GetTouchControls() const { return TouchControls.Get(); }
	bool IsCapturing() const { return !CaptureDir.IsEmpty(); }
	// Recorded frame index (negative while warming up).
	int32 CaptureFrame() const { return bCaptureReady ? FrameCounter - CaptureWarmup : -1; }

protected:
	virtual void Tick(float DeltaSeconds) override;
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type Reason) override;

private:
	TSharedPtr<SWarTouchControls> TouchControls;

	FString CaptureDir;
	int32 CaptureFrames = 1;
	int32 CaptureWarmup = 90;
	int32 FrameCounter = 0;
	bool bCaptureReady = false;
	bool bCaptureView = false;
	FVector CaptureLocation = FVector::ZeroVector;
	FRotator CaptureRotation = FRotator::ZeroRotator;
};
