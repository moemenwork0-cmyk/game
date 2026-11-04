#pragma once

#include "GameFramework/Actor.h"
#include "WarSoldier.generated.h"

class UAnimSequence;
class USkeletalMeshComponent;

// A scripted teammate: plays Mixamo clips (single-node, no anim blueprint) while the breach
// director walks him around. Walk/run clips are in place; the actor itself moves.
UCLASS()
class WARGAME_API AWarSoldier : public AActor
{
	GENERATED_BODY()

public:
	AWarSoldier();

	void Play(FName Clip, bool bLoop, float Rate = 1.f);
	// Walks (or runs) to Target playing Clip at Speed (cm/s), then calls Done.
	void MoveTo(const FVector& Target, float Speed, FName Clip, float Rate, TFunction<void()> Done = nullptr);
	void FaceTowards(const FVector& Point) { FacePoint = Point; bFacePoint = true; }
	void Stop() { bMoving = false; OnArrived = nullptr; }
	// After a clip that travels inside the animation (the dive), move the actor under the hips
	// so the next clip starts where the body actually is.
	void SettleOnHips();
	// Length in seconds of a clip at a play rate.
	float ClipLength(FName Clip, float Rate = 1.f) const;

	UPROPERTY(VisibleAnywhere, Category = "War")
	TObjectPtr<USkeletalMeshComponent> Mesh;

	UPROPERTY()
	TMap<FName, TObjectPtr<UAnimSequence>> Clips;

protected:
	virtual void Tick(float DeltaSeconds) override;

private:
	FVector Target = FVector::ZeroVector;
	float Speed = 0.f;
	bool bMoving = false;
	TFunction<void()> OnArrived;
	FVector FacePoint = FVector::ZeroVector;
	bool bFacePoint = false;
};
