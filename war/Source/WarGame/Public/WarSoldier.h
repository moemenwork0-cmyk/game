#pragma once

#include "GameFramework/Actor.h"
#include "WarSoldier.generated.h"

class UAnimSequence;
class USkeletalMeshComponent;
class UWarAnimInstance;

// A scripted teammate. Clips cross-fade through UWarAnimInstance; walking follows the nav mesh
// around the rocks, turns on the spot with the turn clips first when the path bends hard, and
// ends with a stop clip. Walk/run clips are in place: the actor itself moves at the clip's speed.
UCLASS()
class WARGAME_API AWarSoldier : public AActor
{
	GENERATED_BODY()

public:
	AWarSoldier();

	void Play(FName Clip, bool bLoop, float Rate = 1.f, float Blend = 0.25f);
	// Walks (or runs) to Target along the nav mesh playing Clip at Speed (cm/s), then calls Done.
	void MoveTo(const FVector& Target, float Speed, FName Clip, float Rate, TFunction<void()> Done = nullptr, bool bStopClip = true);
	void FaceTowards(const FVector& Point) { FacePoint = Point; bFacePoint = true; }
	void Stop() { Path.Reset(); bMoving = false; OnArrived = nullptr; }
	float ClipLength(FName Clip, float Rate = 1.f) const;
	// After a clip that travels inside the animation (the dive), move the actor under the hips.
	void SettleOnHips();
	// Extra height offset while going down the stairs (the actor sinks with the clip).
	void SetSink(float Z) { Sink = Z; }

	UPROPERTY(VisibleAnywhere, Category = "War")
	TObjectPtr<USkeletalMeshComponent> Mesh;

	UPROPERTY()
	TMap<FName, TObjectPtr<UAnimSequence>> Clips;

	float GroundZ = 0.f;

protected:
	virtual void Tick(float DeltaSeconds) override;

private:
	UWarAnimInstance* Anim() const;
	void NextLeg();

	TArray<FVector> Path;
	float Speed = 0.f;
	FName MoveClip;
	float MoveRate = 1.f;
	bool bMoving = false;
	bool bUseStop = true;
	float TurnLeft = 0.f;     // seconds left in a turn-on-the-spot clip
	float TurnYaw = 0.f;      // yaw to add when it ends
	TFunction<void()> OnArrived;
	FVector FacePoint = FVector::ZeroVector;
	bool bFacePoint = false;
	float Sink = 0.f;
};
