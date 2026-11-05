#pragma once

#include "Animation/AnimInstance.h"
#include "Animation/AnimInstanceProxy.h"
#include "WarAnimInstance.generated.h"

class UAnimSequence;

// Code-only animation player with cross-fades: every clip change blends from the pose that was
// playing over a short time, so walk -> stop -> kneel -> stand flows instead of popping.
// (Single-node playback has no blending; an anim blueprint would be a binary asset.)
struct FWarAnimProxy : public FAnimInstanceProxy
{
	FWarAnimProxy() = default;
	explicit FWarAnimProxy(UAnimInstance* Instance) : FAnimInstanceProxy(Instance) {}

	struct FLayer
	{
		UAnimSequence* Anim = nullptr;
		float Time = 0.f;
		float Rate = 1.f;
		bool bLoop = true;
	};
	FLayer From;
	FLayer To;
	float Blend = 1.f;      // 0 = From, 1 = To
	float BlendTime = 0.25f;

	virtual bool Evaluate(FPoseContext& Output) override;
	virtual void PreUpdate(UAnimInstance* InAnimInstance, float DeltaSeconds) override;
};

UCLASS(Transient, NotBlueprintable)
class WARGAME_API UWarAnimInstance : public UAnimInstance
{
	GENERATED_BODY()

public:
	// Starts Anim, cross-fading from whatever is playing.
	void Play(UAnimSequence* Anim, bool bLoop, float Rate = 1.f, float BlendTime = 0.25f, float StartTime = 0.f);
	UAnimSequence* Current() const { return Pending.Anim; }
	float CurrentTime() const;

protected:
	virtual FAnimInstanceProxy* CreateAnimInstanceProxy() override { return new FWarAnimProxy(this); }
	virtual void DestroyAnimInstanceProxy(FAnimInstanceProxy* InProxy) override { delete InProxy; }

private:
	friend struct FWarAnimProxy;
	FWarAnimProxy::FLayer Pending;
	float PendingBlend = 0.25f;
	bool bChanged = false;
	float ToTimeGameThread = 0.f;
};
